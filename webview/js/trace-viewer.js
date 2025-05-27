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
      
      // State for filtering and search
      let searchTerm = '';
      let activeFilters = {
        spanTypes: new Set(), // Empty = show all
        errorOnly: false,
        minDuration: 0, // milliseconds
        maxDuration: Infinity
      };
      let filteredSpans = rootSpans; // Will be updated by filtering logic
      
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
       * Apply filters and search to spans
       * @param {Array} spans - Array of spans to filter
       * @param {string} search - Search term
       * @param {Object} filters - Filter criteria
       * @return {Array} Filtered spans
       */
      const applyFiltersAndSearch = (spans, search, filters) => {
        const searchLower = search.toLowerCase();
        
        const filterSpan = (span) => {
          // Search filter - check span name and attributes
          if (search && !span.name.toLowerCase().includes(searchLower)) {
            // Also search in attributes
            const attributeMatch = Object.entries(span.attributes).some(([key, value]) => {
              const valueStr = Array.isArray(value) ? value.join(' ') : String(value);
              return key.toLowerCase().includes(searchLower) || 
                     valueStr.toLowerCase().includes(searchLower);
            });
            if (!attributeMatch) return false;
          }
          
          // Error filter
          if (filters.errorOnly && !span.isError) return false;
          
          // Duration filter
          if (span.duration < filters.minDuration || span.duration > filters.maxDuration) {
            return false;
          }
          
          // Span type filter
          if (filters.spanTypes.size > 0 && !filters.spanTypes.has(span.typeClass)) {
            return false;
          }
          
          return true;
        };
        
        const filterRecursive = (spanList) => {
          const filtered = [];
          for (const span of spanList) {
            const spanMatches = filterSpan(span);
            const filteredChildren = filterRecursive(span.children);
            
            // Include span if it matches OR if any children match
            if (spanMatches || filteredChildren.length > 0) {
              const filteredSpan = { ...span, children: filteredChildren };
              filtered.push(filteredSpan);
            }
          }
          return filtered;
        };
        
        return filterRecursive(spans);
      };
      
      /**
       * Update filters and re-render
       * @param {Object} newFilters - Updated filter criteria
       */
      const updateFilters = (newFilters) => {
        activeFilters = { ...activeFilters, ...newFilters };
        filteredSpans = applyFiltersAndSearch(rootSpans, searchTerm, activeFilters);
        rerenderTraceViewer();
      };
      
      /**
       * Update search term and re-render
       * @param {string} newSearchTerm - New search term
       */
      const updateSearch = (newSearchTerm) => {
        searchTerm = newSearchTerm;
        filteredSpans = applyFiltersAndSearch(rootSpans, searchTerm, activeFilters);
        rerenderTraceViewer();
      };
      
      /**
       * Get unique span types from all spans for filter options
       * @param {Array} spans - Array of spans to analyze
       * @return {Array} Array of unique span types
       */
      const getSpanTypes = (spans) => {
        const types = new Set();
        const collectTypes = (spanList) => {
          for (const span of spanList) {
            if (span.typeClass) types.add(span.typeClass);
            collectTypes(span.children);
          }
        };
        collectTypes(spans);
        return Array.from(types).sort();
      };
      
      /**
       * Identify critical path (longest dependency chain)
       * @param {Array} spans - Array of spans to analyze
       * @return {Array} Array of span IDs in critical path
       */
      const findCriticalPath = (spans) => {
        let longestPath = [];
        let maxDuration = 0;
        
        const findLongestPath = (span, currentPath, currentDuration) => {
          const newPath = [...currentPath, span.id];
          const newDuration = currentDuration + span.duration;
          
          if (span.children.length === 0) {
            // Leaf node - check if this is the longest path
            if (newDuration > maxDuration) {
              maxDuration = newDuration;
              longestPath = newPath;
            }
          } else {
            // Continue with children
            for (const child of span.children) {
              findLongestPath(child, newPath, newDuration);
            }
          }
        };
        
        for (const span of spans) {
          findLongestPath(span, [], 0);
        }
        
        return longestPath;
      };
      
      /**
       * Analyze performance and identify bottlenecks
       * @param {Array} spans - Array of spans to analyze
       * @return {Object} Performance analysis results
       */
      const analyzePerformance = (spans) => {
        const allSpans = [];
        const collectSpans = (spanList) => {
          for (const span of spanList) {
            allSpans.push(span);
            collectSpans(span.children);
          }
        };
        collectSpans(spans);
        
        // Sort by duration to find slowest spans
        const sortedByDuration = [...allSpans].sort((a, b) => b.duration - a.duration);
        const slowestSpans = sortedByDuration.slice(0, 5);
        
        // Calculate total time and identify parallel vs sequential execution
        const totalDuration = Math.max(...allSpans.map(span => span.startTime + span.duration));
        const sumOfAllDurations = allSpans.reduce((sum, span) => sum + span.duration, 0);
        const parallelizationRatio = totalDuration / sumOfAllDurations;
        
        // Group spans by type for analysis
        const spansByType = {};
        allSpans.forEach(span => {
          const type = span.typeClass || 'unknown';
          if (!spansByType[type]) {
            spansByType[type] = [];
          }
          spansByType[type].push(span);
        });
        
        // Calculate type statistics
        const typeStats = Object.entries(spansByType).map(([type, typeSpans]) => ({
          type,
          count: typeSpans.length,
          totalDuration: typeSpans.reduce((sum, span) => sum + span.duration, 0),
          avgDuration: typeSpans.reduce((sum, span) => sum + span.duration, 0) / typeSpans.length,
          maxDuration: Math.max(...typeSpans.map(span => span.duration))
        })).sort((a, b) => b.totalDuration - a.totalDuration);
        
        // Identify errors
        const errorSpans = allSpans.filter(span => span.isError);
        
        return {
          totalSpans: allSpans.length,
          totalDuration,
          sumOfAllDurations,
          parallelizationRatio,
          slowestSpans,
          typeStats,
          errorSpans,
          criticalPath: findCriticalPath(spans)
        };
      };
      
      /**
       * Create performance insights panel
       * @param {Object} analysis - Performance analysis results
       * @return {React.Element} Performance insights element
       */
      const createPerformanceInsights = (analysis) => {
        return createElement('div', { className: 'trace-performance-insights' },
          createElement('h4', { className: 'trace-insights-title' }, '📊 Performance Insights'),
          
          // Overall metrics
          createElement('div', { className: 'trace-insights-section' },
            createElement('h5', null, 'Overview'),
            createElement('div', { className: 'trace-insights-grid' },
              createElement('div', null, 'Total Spans:'),
              createElement('div', null, analysis.totalSpans),
              createElement('div', null, 'Total Duration:'),
              createElement('div', null, formatDuration(analysis.totalDuration)),
              createElement('div', null, 'Parallelization:'),
              createElement('div', null, `${(analysis.parallelizationRatio * 100).toFixed(1)}%`),
              analysis.errorSpans.length > 0 ? [
                createElement('div', { key: 'error-label' }, 'Errors:'),
                createElement('div', { key: 'error-count', className: 'trace-error-count' }, analysis.errorSpans.length)
              ] : null
            )
          ),
          
          // Slowest spans
          analysis.slowestSpans.length > 0 ? createElement('div', { className: 'trace-insights-section' },
            createElement('h5', null, 'Slowest Spans'),
            createElement('div', { className: 'trace-slowest-spans' },
              analysis.slowestSpans.map((span, index) =>
                createElement('div', { 
                  key: span.id, 
                  className: 'trace-slow-span',
                  onClick: () => selectSpan(span),
                  title: 'Click to view details'
                },
                  createElement('span', { className: 'trace-slow-span-rank' }, `#${index + 1}`),
                  createElement('span', { className: 'trace-slow-span-name' }, span.name),
                  createElement('span', { className: 'trace-slow-span-duration' }, formatDuration(span.duration))
                )
              )
            )
          ) : null,
          
          // Type breakdown
          analysis.typeStats.length > 0 ? createElement('div', { className: 'trace-insights-section' },
            createElement('h5', null, 'By Type'),
            createElement('div', { className: 'trace-type-stats' },
              analysis.typeStats.map(stat =>
                createElement('div', { key: stat.type, className: 'trace-type-stat' },
                  createElement('span', { className: `trace-type-stat-label ${stat.type}` }, 
                    stat.type.replace('span-', '').toUpperCase()
                  ),
                  createElement('span', { className: 'trace-type-stat-count' }, `${stat.count} spans`),
                  createElement('span', { className: 'trace-type-stat-duration' }, formatDuration(stat.totalDuration))
                )
              )
            )
          ) : null
        );
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
      
      // Get available span types for filtering
      const availableSpanTypes = getSpanTypes(rootSpans);
      
      // Calculate critical path
      const criticalPath = findCriticalPath(rootSpans);
      
      // Analyze performance
      const performanceAnalysis = analyzePerformance(rootSpans);
      
      /**
       * Create filter controls UI
       * @return {React.Element} Filter controls element
       */
      const createFilterControls = () => {
        return createElement('div', { className: 'trace-filter-controls' },
          // Search input
          createElement('div', { className: 'trace-filter-section' },
            createElement('label', { className: 'trace-filter-label' }, 'Search'),
            createElement('input', {
              type: 'text',
              className: 'trace-search-input',
              placeholder: 'Search spans and attributes...',
              value: searchTerm,
              onChange: (e) => updateSearch(e.target.value)
            })
          ),
          
          // Span type filters
          availableSpanTypes.length > 0 ? createElement('div', { className: 'trace-filter-section' },
            createElement('label', { className: 'trace-filter-label' }, 'Span Types'),
            createElement('div', { className: 'trace-filter-checkboxes' },
              availableSpanTypes.map(spanType => 
                createElement('label', { 
                  key: spanType, 
                  className: 'trace-filter-checkbox-label' 
                },
                  createElement('input', {
                    type: 'checkbox',
                    checked: activeFilters.spanTypes.has(spanType),
                    onChange: (e) => {
                      const newTypes = new Set(activeFilters.spanTypes);
                      if (e.target.checked) {
                        newTypes.add(spanType);
                      } else {
                        newTypes.delete(spanType);
                      }
                      updateFilters({ spanTypes: newTypes });
                    }
                  }),
                  createElement('span', { className: `trace-filter-type-label ${spanType}` }, 
                    spanType.replace('span-', '').toUpperCase()
                  )
                )
              )
            )
          ) : null,
          
          // Error filter
          createElement('div', { className: 'trace-filter-section' },
            createElement('label', { className: 'trace-filter-checkbox-label' },
              createElement('input', {
                type: 'checkbox',
                checked: activeFilters.errorOnly,
                onChange: (e) => updateFilters({ errorOnly: e.target.checked })
              }),
              createElement('span', null, 'Errors Only')
            )
          ),
          
          // Duration filter
          createElement('div', { className: 'trace-filter-section' },
            createElement('label', { className: 'trace-filter-label' }, 'Min Duration (ms)'),
            createElement('input', {
              type: 'number',
              className: 'trace-duration-input',
              min: '0',
              step: '0.1',
              value: activeFilters.minDuration,
              onChange: (e) => updateFilters({ minDuration: parseFloat(e.target.value) || 0 })
            })
          ),
          
          // Critical path toggle
          createElement('div', { className: 'trace-filter-section' },
            createElement('button', {
              className: 'trace-action-button trace-action-secondary',
              onClick: () => {
                // Highlight critical path spans
                const criticalSpanIds = new Set(criticalPath);
                // This would need additional state management to highlight spans
                if (typeof vscode !== 'undefined') {
                  vscode.postMessage({
                    command: 'debug-log',
                    message: `Critical path: ${criticalPath.length} spans, total duration: ${formatDuration(duration)}`
                  });
                }
              },
              title: 'Highlight the critical path (longest dependency chain)'
            }, '🎯 Show Critical Path')
          ),
          
          // Clear filters
          createElement('div', { className: 'trace-filter-section' },
            createElement('button', {
              className: 'trace-action-button trace-action-secondary',
              onClick: () => {
                searchTerm = '';
                activeFilters = {
                  spanTypes: new Set(),
                  errorOnly: false,
                  minDuration: 0,
                  maxDuration: Infinity
                };
                filteredSpans = rootSpans;
                rerenderTraceViewer();
              },
              title: 'Clear all filters and search'
            }, '🗑️ Clear Filters')
          )
        );
      };
      
      /**
       * Create the complete trace viewer structure
       * @return {React.Element} Complete trace viewer element
       */
      const createCompleteTraceViewer = () => {
        // Create time scale markers
        const currentTimeMarkers = [];
        const steps = 6; // Number of time markers
        for (let i = 0; i <= steps; i++) {
          const time = (duration / steps) * i;
          currentTimeMarkers.push({
            time: time,
            percent: timeToPercent(time),
            label: formatDuration(time)
          });
        }
        
        return createElement('div', { 
          className: 'trace-viewer',
          ref: (el) => { containerElement = el; }
        },
          // Filter controls
          createFilterControls(),
          
          // Main content area
          createElement('div', { className: 'trace-main-content' },
            // Left side: Spans with header and timeline
            createElement('div', { 
              className: 'trace-spans-container' + (detailsPanelVisible ? ' with-details-panel' : '')
            },
              // Span and timeline headers
              createElement('div', { className: 'trace-header' },
                createElement('div', { className: 'trace-labels' },
                  createElement('div', { className: 'trace-title' }, 'Span'),
                  createElement('div', { className: 'trace-duration-label' }, 'Duration')
                ),
                createElement('div', { className: 'trace-timeline-header' },
                  currentTimeMarkers.map(marker => 
                    createElement('div', {
                      key: marker.time,
                      className: 'trace-time-marker',
                      style: { left: marker.percent }
                    }, marker.label)
                  )
                )
              ),
              
              // Spans list
              createElement('div', { className: 'trace-spans' },
                renderSpansHierarchy(filteredSpans)
              )
            ),
            
            // Right panel: Performance insights OR details panel
            createElement('div', { className: 'trace-right-panel' },
              detailsPanelVisible ? 
                createDetailsPanel(selectedSpan) : 
                createElement('div', { className: 'trace-insights-container' },
                  createPerformanceInsights(analyzePerformance(filteredSpans))
                )
            )
          )
        );
      };
      
      // Store reference for re-rendering
      let containerElement = null;
      
      /**
       * Re-render the trace viewer (for state updates)
       */
      const rerenderTraceViewer = () => {
        if (containerElement && containerElement.parentNode) {
          // Re-create the entire trace viewer with updated state
          const newTraceViewer = createCompleteTraceViewer();
          
          // Replace the entire trace viewer
          window.ReactDOM.render(newTraceViewer, containerElement.parentNode);
        }
      };
      
      // Return the initial trace viewer
      return createCompleteTraceViewer();
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