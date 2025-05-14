// results-panel.js
(function() {
    /**
     * Initialize the results panel with the provided payload
     * @param {Object} payload - Response payload from StepZen
     */
    function initResultsPanel(payload) {
      // Get React and ReactDOM
      const React = window.React;
      const ReactDOM = window.ReactDOM;
      const createElement = React.createElement;
      
      // Detect theme
      const isDarkTheme = document.body.classList.contains('vscode-dark') || 
                          document.body.classList.contains('vscode-high-contrast');
      const theme = isDarkTheme ? 'monokai' : 'rjv-default';
      
      // Get ReactJsonView component
      const ReactJson = getReactJsonView();
      if (!ReactJson) {
        console.error('React JSON View component not found');
        document.getElementById('pane-data').innerHTML = 
          '<div class="error-message">Error: React JSON View component not found</div>';
        return;
      }
      
      // Render the Data tab
      ReactDOM.render(
        createElement(ReactJson, {
          src: payload.data ?? payload,
          theme: theme,
          name: null,
          collapsed: false,
          displayDataTypes: false,
          enableClipboard: true,
          className: 'rjv'
        }),
        document.getElementById('pane-data')
      );
      
      // Render the Errors tab if there are errors
      if (payload.errors && payload.errors.length) {
        ReactDOM.render(
          createElement(ReactJson, {
            src: payload.errors,
            theme: theme,
            name: null,
            collapsed: false,
            displayDataTypes: false,
            className: 'rjv'
          }),
          document.getElementById('pane-errors')
        );
      }
      
      // Get diagnostics
      const diagnostics = payload.extensions?.stepzen?.diagnostics ?? [];
      
      // Render the Debug tab
      ReactDOM.render(
        createElement(ReactJson, {
          src: diagnostics,
          theme: theme,
          name: null,
          collapsed: 2,
          displayDataTypes: false,
          className: 'rjv'
        }),
        document.getElementById('pane-debug')
      );
      
      // Render the Trace tab
      const traceData = window.TraceViewer.extractOtelTraces(diagnostics);
      if (traceData) {
        ReactDOM.render(
          window.TraceViewer.createTraceViewer(createElement, traceData),
          document.getElementById('pane-trace')
        );
      } else {
        ReactDOM.render(
          createElement('div', { className: 'no-trace-data' },
            'No trace data available'
          ),
          document.getElementById('pane-trace')
        );
      }
      
      // Setup tab switching
      setupTabs();
    }
    
    /**
     * Setup tab switching functionality
     */
    function setupTabs() {
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // Deactivate current active tab
          const activeTab = document.querySelector('.tab.active');
          if (activeTab) {
            activeTab.classList.remove('active');
          }
          
          // Activate clicked tab
          tab.classList.add('active');
          
          // Show corresponding pane and hide others
          const tabId = tab.dataset.id;
          document.querySelectorAll('[id^="pane-"]').forEach(pane => {
            pane.hidden = pane.id !== `pane-${tabId}`;
          });
        });
      });
      
      // Activate first tab by default
      if (tabs.length > 0) {
        tabs[0].click();
      }
    }
    
    /**
     * Find ReactJsonView component in global scope
     * @return {Function|null} ReactJsonView component or null if not found
     */
    function getReactJsonView() {
      // Try common names
      for (const name of ['ReactJsonView', 'ReactJson']) {
        try {
          let component = window[name];
          if (component?.default) component = component.default;
          if (typeof component === 'function') return component;
        } catch (e) {
          // Cross-origin key, skip
        }
      }
      
      // Fallback: look for any key containing "json" that is a function
      for (const key of Object.keys(window)) {
        if (!/json/i.test(key)) continue;
        try {
          let component = window[key];
          if (component?.default) component = component.default;
          if (typeof component === 'function') return component;
        } catch (e) {
          // Cross-origin key, skip
        }
      }
      
      return null;
    }
    
    // Export functions to global scope
    window.ResultsPanel = {
      initResultsPanel
    };
  })();