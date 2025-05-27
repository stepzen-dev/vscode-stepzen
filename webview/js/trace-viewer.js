/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

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
            
            // Extract all attributes for comprehensive details
            const attributes = {};
            if (span.attributes) {
              span.attributes.forEach(attr => {
                if (attr.key && attr.value) {
                  // Handle different value types
                  if (attr.value.stringValue !== undefined) {
                    attributes[attr.key] = attr.value.stringValue;
                  } else if (attr.value.intValue !== undefined) {
                    attributes[attr.key] = attr.value.intValue;
                  } else if (attr.value.doubleValue !== undefined) {
                    attributes[attr.key] = attr.value.doubleValue;
                  } else if (attr.value.boolValue !== undefined) {
                    attributes[attr.key] = attr.value.boolValue;
                  } else if (attr.value.arrayValue !== undefined) {
                    // Handle array values (e.g., graphql.field.path)
                    const arrayValues = attr.value.arrayValue.values || [];
                    attributes[attr.key] = arrayValues.map(v => {
                      if (v.stringValue !== undefined) return v.stringValue;
                      if (v.intValue !== undefined) return v.intValue;
                      if (v.doubleValue !== undefined) return v.doubleValue;
                      if (v.boolValue !== undefined) return v.boolValue;
                      return v;
                    });
                  }
                }
              });
            }
            
            // Extract http info from attributes if present
            const httpMethod = attributes['http.method'];
            const httpUrl = attributes['http.url'];
            const httpStatus = attributes['http.status_code'];
            
            // Get span kind and set color class
            const spanKind = attributes['span.kind'] || span.kind || '';
            let typeClass = '';
            
            if (span.name?.startsWith('fetch:')) typeClass = 'span-http';
            else if (spanKind === 'server') typeClass = 'span-server';
            else if (spanKind === 'client') typeClass = 'span-client';
            else if (span.name?.includes('sql') || span.name?.includes('postgres')) typeClass = 'span-db';
            else if (span.name?.includes('resolve')) typeClass = 'span-resolve';
            else if (span.name?.includes('factory')) typeClass = 'span-factory';
            else if (span.name?.includes('materializ')) typeClass = 'span-materialization';
            
            // Determine span status
            const status = span.status || {};
            const isError = status.code === 2 || httpStatus >= 400; // OTEL status code 2 = ERROR
            
            const spanInfo = {
              id: span.spanId,
              parentId: span.parentSpanId || null,
              name: span.name || 'unnamed',
              startTime: relativeStart,
              duration: duration,
              endTime: relativeStart + duration,
              typeClass: typeClass,
              isError: isError,
              status: status,
              attributes: attributes,
              httpMethod,
              httpUrl,
              httpStatus,
              spanKind,
              children: [],
              level: 0, // Will be calculated later
              expanded: true, // For collapsible functionality
              // Store original OTEL data for details panel
              originalSpan: span,
              resource: rs.resource || {},
              scope: ss.scope || {}
            };
            
            spans.push(spanInfo);
            spanMap.set(span.spanId, spanInfo);
          }
        }
      }
      
      // Build the parent-child relationships and calculate levels
      const rootSpans = [];
      for (const span of spans) {
        if (span.parentId && spanMap.has(span.parentId)) {
          const parent = spanMap.get(span.parentId);
          parent.children.push(span);
          span.level = parent.level + 1;
        } else {
          rootSpans.push(span);
          span.level = 0;
        }
      }
      
      // Sort children by start time
      function sortChildren(span) {
        span.children.sort((a, b) => a.startTime - b.startTime);
        span.children.forEach(sortChildren);
      }
      rootSpans.forEach(sortChildren);
      
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
     * Create a trace viewer component with hierarchical display and details panel
     * @param {Function} createElement - React.createElement function
     * @param {Object} traceData - Normalized trace data
     * @return {React.Element} Trace viewer component
     */
    function createTraceViewer(createElement, traceData) {
      const { rootSpans, duration } = traceData;
      
      // State for selected span and details panel
      let selectedSpan = null;
      let detailsPanelVisible = false;
      
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
      
      /**
       * Convert time to percentage number for width calculations
       * @param {number} time - Time in milliseconds
       * @return {number} Percentage as number
       */
      const timeToPercentNumber = (time) => {
        return (time / duration * 100);
      };
      
      /**
       * Toggle span expansion state
       * @param {Object} span - Span to toggle
       */
      const toggleSpanExpansion = (span) => {
        span.expanded = !span.expanded;
        // Re-render the component
        rerenderTraceViewer();
      };
      
      /**
       * Select a span and show details panel
       * @param {Object} span - Span to select
       */
      const selectSpan = (span) => {
        selectedSpan = span;
        detailsPanelVisible = true;
        rerenderTraceViewer();
      };
      
      /**
       * Close the details panel
       */
      const closeDetailsPanel = () => {
        selectedSpan = null;
        detailsPanelVisible = false;
        rerenderTraceViewer();
      };
      
      /**
       * Recursively render spans with hierarchy
       * @param {Array} spans - Array of spans to render
       * @return {Array} Array of React elements
       */
      const renderSpansHierarchy = (spans) => {
        const elements = [];
        
        for (const span of spans) {
          // Calculate bar position and width
          const barStyle = {
            left: timeToPercent(span.startTime),
            width: Math.max(timeToPercentNumber(span.duration), 0.1) + '%' // Use number function for width
          };
          
          // Build class name with type and error status
          const barClassName = 'trace-span-bar ' + 
                              (span.typeClass || '') + 
                              (span.isError ? ' trace-span-error' : '') +
                              (selectedSpan?.id === span.id ? ' trace-span-selected' : '');
          
          // Create indentation for hierarchy
          const indentStyle = {
            paddingLeft: (span.level * 20) + 'px'
          };
          
          // Create the span element
          const spanElement = createElement('div', {
            key: span.id,
            className: 'trace-span',
            'data-id': span.id,
            'data-level': span.level
          },
            createElement('div', { 
              className: 'trace-span-info',
              style: indentStyle
            },
              // Expansion toggle for spans with children
              span.children.length > 0 ? createElement('span', {
                className: 'trace-span-toggle ' + (span.expanded ? 'expanded' : 'collapsed'),
                onClick: (e) => {
                  e.stopPropagation();
                  toggleSpanExpansion(span);
                }
              }, span.expanded ? '▼' : '▶') : createElement('span', {
                className: 'trace-span-toggle-spacer'
              }),
              
              createElement('div', { 
                className: 'trace-span-name',
                onClick: () => selectSpan(span),
                title: `Click to view details\n${span.name}`
              }, span.name),
              
              createElement('div', { className: 'trace-span-duration' }, formatDuration(span.duration))
            ),
            createElement('div', { className: 'trace-span-timeline' },
              createElement('div', {
                className: barClassName,
                style: barStyle,
                onClick: () => selectSpan(span),
                title: `${span.name}\nDuration: ${formatDuration(span.duration)}\nStart: ${formatDuration(span.startTime)}`
              })
            )
          );
          
          elements.push(spanElement);
          
          // Recursively render children if expanded
          if (span.expanded && span.children.length > 0) {
            elements.push(...renderSpansHierarchy(span.children));
          }
        }
        
        return elements;
      };
      
      /**
       * Create the details panel content
       * @param {Object} span - Selected span
       * @return {React.Element} Details panel element
       */
      const createDetailsPanel = (span) => {
        if (!span) return null;
        
        // Calculate self time (time spent in this span excluding children)
        const childrenDuration = span.children.reduce((sum, child) => sum + child.duration, 0);
        const selfTime = span.duration - childrenDuration;
        
        // Check if this span has GraphQL field information for navigation
        const hasFieldPath = span.attributes['graphql.field.path'] && Array.isArray(span.attributes['graphql.field.path']);
        const fieldPath = hasFieldPath ? span.attributes['graphql.field.path'] : null;
        const directive = span.attributes['graphql.field.directive'];
        
        /**
         * Send a message to the VS Code extension
         * @param {string} command - The command to send
         * @param {Object} data - Additional data to send
         */
        const sendMessage = (command, data = {}) => {
          if (typeof vscode !== 'undefined') {
            vscode.postMessage({
              command,
              spanName: span.name,
              spanId: span.id,
              spanAttributes: span.attributes,
              ...data
            });
          } else {
            // Send debug message instead of console.warn for linter compliance
            if (typeof vscode !== 'undefined') {
              vscode.postMessage({
                command: 'debug-log',
                message: 'VS Code API not available for trace viewer navigation'
              });
            }
          }
        };
        
        return createElement('div', { className: 'trace-details-panel' },
          createElement('div', { className: 'trace-details-header' },
            createElement('h3', { className: 'trace-details-title' }, span.name),
            createElement('button', {
              className: 'trace-details-close',
              onClick: closeDetailsPanel,
              title: 'Close details panel'
            }, '×')
          ),
          
          createElement('div', { className: 'trace-details-content' },
            // VS Code Integration Actions (if applicable)
            hasFieldPath ? createElement('div', { className: 'trace-details-section' },
              createElement('h4', null, 'VS Code Actions'),
              createElement('div', { className: 'trace-details-actions' },
                createElement('button', {
                  className: 'trace-action-button trace-action-primary',
                  onClick: () => sendMessage('navigateToSchema'),
                  title: `Navigate to schema definition for ${fieldPath.join('.')}`
                }, '📄 Go to Schema Definition')
              ),
              
              // Show field path information
              createElement('div', { className: 'trace-field-info' },
                createElement('div', { className: 'trace-field-path' },
                  createElement('strong', null, 'Field Path: '),
                  createElement('code', null, fieldPath.join(' → '))
                ),
                directive ? createElement('div', { className: 'trace-field-directive' },
                  createElement('strong', null, 'Directive: '),
                  createElement('code', null, directive)
                ) : null
              )
            ) : null,
            
            // Timing information
            createElement('div', { className: 'trace-details-section' },
              createElement('h4', null, 'Timing'),
              createElement('div', { className: 'trace-details-grid' },
                createElement('div', null, 'Duration:'),
                createElement('div', null, formatDuration(span.duration)),
                createElement('div', null, 'Self Time:'),
                createElement('div', null, formatDuration(selfTime)),
                createElement('div', null, 'Start Time:'),
                createElement('div', null, formatDuration(span.startTime)),
                createElement('div', null, 'End Time:'),
                createElement('div', null, formatDuration(span.endTime))
              )
            ),
            
            // Status information
            span.status && Object.keys(span.status).length > 0 ? createElement('div', { className: 'trace-details-section' },
              createElement('h4', null, 'Status'),
              createElement('div', { className: 'trace-details-grid' },
                span.status.code !== undefined ? [
                  createElement('div', { key: 'status-code-label' }, 'Code:'),
                  createElement('div', { key: 'status-code-value' }, span.status.code)
                ] : null,
                span.status.message ? [
                  createElement('div', { key: 'status-msg-label' }, 'Message:'),
                  createElement('div', { key: 'status-msg-value' }, span.status.message)
                ] : null
              )
            ) : null,
            
            // Attributes
            Object.keys(span.attributes).length > 0 ? createElement('div', { className: 'trace-details-section' },
              createElement('h4', null, 'Attributes'),
              createElement('div', { className: 'trace-details-attributes' },
                Object.entries(span.attributes).map(([key, value]) =>
                  createElement('div', { key: key, className: 'trace-details-attribute' },
                    createElement('span', { className: 'trace-details-attribute-key' }, key + ':'),
                    createElement('span', { className: 'trace-details-attribute-value' }, 
                      Array.isArray(value) ? value.join(', ') : String(value)
                    )
                  )
                )
              )
            ) : null,
            
            // Children summary
            span.children.length > 0 ? createElement('div', { className: 'trace-details-section' },
              createElement('h4', null, 'Children'),
              createElement('div', null, `${span.children.length} child span${span.children.length === 1 ? '' : 's'}`)
            ) : null
          )
        );
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
      
      // Create main content area
      const mainContent = createElement('div', { className: 'trace-main-content' },
        // Spans container
        createElement('div', { 
          className: 'trace-spans-container' + (detailsPanelVisible ? ' with-details-panel' : '')
        },
          createElement('div', { className: 'trace-spans' },
            renderSpansHierarchy(rootSpans)
          )
        ),
        
        // Details panel (conditionally rendered)
        detailsPanelVisible ? createDetailsPanel(selectedSpan) : null
      );
      
      // Store reference for re-rendering
      let containerElement = null;
      
      /**
       * Re-render the trace viewer (for state updates)
       */
      const rerenderTraceViewer = () => {
        if (containerElement) {
          // Re-render the main content
          const newMainContent = createElement('div', { className: 'trace-main-content' },
            createElement('div', { 
              className: 'trace-spans-container' + (detailsPanelVisible ? ' with-details-panel' : '')
            },
              createElement('div', { className: 'trace-spans' },
                renderSpansHierarchy(rootSpans)
              )
            ),
            detailsPanelVisible ? createDetailsPanel(selectedSpan) : null
          );
          
          // Find and replace the main content
          const oldMainContent = containerElement.querySelector('.trace-main-content');
          if (oldMainContent) {
            window.ReactDOM.render(newMainContent, oldMainContent.parentNode);
          }
        }
      };
      
      // Create the main trace viewer element
      const traceViewer = createElement('div', { 
        className: 'trace-viewer',
        ref: (el) => { containerElement = el; }
      },
        headerElement,
        mainContent
      );
      
      return traceViewer;
    }
    
    // Export functions to global scope
    window.TraceViewer = {
      extractOtelTraces,
      createTraceViewer
    };
    
    // Send initialization message to VS Code for debugging
    if (typeof vscode !== 'undefined') {
      vscode.postMessage({
        command: 'debug-log',
        message: 'Trace viewer initialized with VS Code integration support'
      });
    }
  })();