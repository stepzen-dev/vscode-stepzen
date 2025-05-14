// trace-viewer.js
(function() {
    /**
     * Extract and normalize OpenTelemetry trace data from diagnostics
     * @param {Array} diags - Raw diagnostics data
     * @return {Object|null} Normalized trace data or null if no trace data found
     */
    function extractOtelTraces(diags) {
      // Find the OTEL entry
      const otelEntry = diags.find(d => !!d.otel?.traces?.resourceSpans);
      if (!otelEntry) return null;
      
      // Extract spans with their relationships and timing
      const spans = [];
      const spanMap = new Map();
      
      // Get the earliest time to use as base (so times start near zero)
      let earliestTime = Number.MAX_SAFE_INTEGER;
      
      // First pass: extract basic span data and find earliest time
      for (const rs of otelEntry.otel.traces.resourceSpans || []) {
        for (const ss of rs.scopeSpans || []) {
          for (const span of ss.spans || []) {
            if (!span.spanId) continue;
            
            // Convert nano to ms for display
            const startMs = span.startTimeUnixNano ? Number(span.startTimeUnixNano) / 1e6 : 0;
            earliestTime = Math.min(earliestTime, startMs);
          }
        }
      }
      
      // Second pass: build span objects with relative times
      for (const rs of otelEntry.otel.traces.resourceSpans || []) {
        for (const ss of rs.scopeSpans || []) {
          for (const span of ss.spans || []) {
            if (!span.spanId) continue;
            
            // Convert nano to ms for display
            const startMs = span.startTimeUnixNano ? Number(span.startTimeUnixNano) / 1e6 : 0;
            const endMs = span.endTimeUnixNano ? Number(span.endTimeUnixNano) / 1e6 : startMs;
            
            // Set times relative to earliest time
            const relativeStart = startMs - earliestTime;
            const duration = endMs - startMs;
            
            // Extract http info from attributes if present
            const httpMethod = span.attributes?.find(a => a.key === 'http.method')?.value?.stringValue;
            const httpUrl = span.attributes?.find(a => a.key === 'http.url')?.value?.stringValue;
            const httpStatus = span.attributes?.find(a => a.key === 'http.status_code')?.value?.intValue || 
                               span.attributes?.find(a => a.key === 'http.status_code')?.value?.stringValue;
            
            // Get span kind and set color class
            const spanKind = span.attributes?.find(a => a.key === 'span.kind')?.value?.stringValue || '';
            let typeClass = '';
            
            if (span.name?.startsWith('fetch:')) typeClass = 'span-http';
            else if (spanKind === 'server') typeClass = 'span-server';
            else if (spanKind === 'client') typeClass = 'span-client';
            else if (span.name?.includes('sql') || span.name?.includes('postgres')) typeClass = 'span-db';
            else if (span.name?.includes('resolve')) typeClass = 'span-resolve';
            else if (span.name?.includes('factory')) typeClass = 'span-factory';
            else if (span.name?.includes('materializ')) typeClass = 'span-materialization';
            
            const spanInfo = {
              id: span.spanId,
              parentId: span.parentSpanId || null,
              name: span.name || 'unnamed',
              startTime: relativeStart,
              duration: duration,
              endTime: relativeStart + duration,
              typeClass: typeClass,
              attributes: {
                httpMethod,
                httpUrl,
                httpStatus,
                spanKind
              },
              children: []
            };
            
            spans.push(spanInfo);
            spanMap.set(span.spanId, spanInfo);
          }
        }
      }
      
      // Build the parent-child relationships
      const rootSpans = [];
      for (const span of spans) {
        if (span.parentId && spanMap.has(span.parentId)) {
          const parent = spanMap.get(span.parentId);
          parent.children.push(span);
        } else {
          rootSpans.push(span);
        }
      }
      
      // Sort spans by start time
      spans.sort((a, b) => a.startTime - b.startTime);
      
      // Calculate total duration
      const totalDuration = spans.length ? 
        Math.max(...spans.map(span => span.startTime + span.duration)) : 0;
      
      return {
        spans,
        rootSpans,
        duration: totalDuration
      };
    }
  
    /**
     * Create a trace viewer component
     * @param {Function} createElement - React.createElement function
     * @param {Object} traceData - Normalized trace data
     * @return {React.Element} Trace viewer component
     */
    function createTraceViewer(createElement, traceData) {
      const { spans, duration } = traceData;
      
      /**
       * Format a duration for display
       * @param {number} ms - Duration in milliseconds
       * @return {string} Formatted duration
       */
      const formatDuration = (ms) => {
        if (ms < 0.1) return '<0.1ms';
        if (ms < 1) return ms.toFixed(1) + 'ms';
        if (ms < 1000) return ms.toFixed(1) + 'ms';
        return (ms / 1000).toFixed(2) + 's';
      };
      
      /**
       * Convert time to percentage for positioning
       * @param {number} time - Time in milliseconds
       * @return {string} Percentage string for CSS
       */
      const timeToPercent = (time) => {
        return (time / duration * 100).toFixed(2) + '%';
      };
      
      // Create time scale markers
      const timeMarkers = [];
      const steps = 6; // Number of time markers
      for (let i = 0; i <= steps; i++) {
        const time = (duration / steps) * i;
        timeMarkers.push({
          time: time,
          percent: timeToPercent(time),
          label: formatDuration(time)
        });
      }
      
      // Create trace header element
      const headerElement = createElement('div', { className: 'trace-header' },
        createElement('div', { className: 'trace-labels' },
          createElement('div', { className: 'trace-title' }, 'Span'),
          createElement('div', { className: 'trace-duration-label' }, 'Duration')
        ),
        createElement('div', { className: 'trace-timeline-header' },
          timeMarkers.map(marker => 
            createElement('div', {
              key: marker.time,
              className: 'trace-time-marker',
              style: { left: marker.percent }
            }, marker.label)
          )
        )
      );
      
      // Create spans list element
      const spansElement = createElement('div', { className: 'trace-spans-container' },
        createElement('div', { className: 'trace-spans' },
          spans.map(span => {
            // Calculate bar position and width
            const barStyle = {
              left: timeToPercent(span.startTime),
              width: timeToPercent(span.duration) 
            };
            
            // Determine if this is an error span
            const isError = span.attributes.httpStatus >= 400;
            
            // Build class name with type and error status
            const barClassName = 'trace-span-bar ' + 
                                (span.typeClass || '') + 
                                (isError ? ' trace-span-error' : '');
            

            // Enhanced tooltip creation
            const createTooltip = (span) => {
              const lines = [
                span.name,
                `Start: ${formatDuration(span.startTime)}`,
                `Duration: ${formatDuration(span.duration)}`
              ];
              
              // Add all attributes with values to the tooltip
              if (span.attributes) {
                const attrEntries = Object.entries(span.attributes)
                  .filter(([_, value]) => value !== undefined && value !== null);
                
                if (attrEntries.length > 0) {
                  lines.push(''); // Empty line to separate basic info from attributes
                  lines.push('Attributes:');
                  attrEntries.forEach(([key, value]) => {
                    lines.push(`  ${key}: ${value}`);
                  });
                }
              }
              
              return lines.join('\n');
            };
            const tooltip = createTooltip(span);

            
            // Create the span element
            return createElement('div', {
              key: span.id,
              className: 'trace-span',
              'data-id': span.id,
              'data-parent': span.parentId || ''
            },
              createElement('div', { className: 'trace-span-info' },
                createElement('div', { className: 'trace-span-name' }, span.name),
                createElement('div', { className: 'trace-span-duration' }, formatDuration(span.duration))
              ),
              createElement('div', { className: 'trace-span-timeline' },
                createElement('div', {
                  className: barClassName,
                  style: barStyle,
                  title: tooltip
                })
              )
            );
          })
        )
      );
      
      // Create the main trace viewer element
      return createElement('div', { className: 'trace-viewer' },
        headerElement,
        spansElement
      );
    }
    
    // Export functions to global scope
    window.TraceViewer = {
      extractOtelTraces,
      createTraceViewer
    };
  })();