(function() {
  const vscode = acquireVsCodeApi();
  
  function debugLog(message) {
    console.log(message);
    vscode.postMessage({
      command: 'debug-log',
      message: message
    });
  }
  
  function displayErrorMessage(message) {
    const diagramEl = document.getElementById('diagram');
    const isDarkTheme = document.body.classList.contains('vscode-dark');
    
    if (diagramEl) {
      diagramEl.innerHTML = `
        <div style="display: flex; height: 100%; align-items: center; justify-content: center; padding: 20px; text-align: center;">
          <div style="max-width: 500px; padding: 30px; border: 1px solid ${isDarkTheme ? '#555' : '#ccc'}; border-radius: 8px; background: ${isDarkTheme ? '#2d2d2d' : 'white'}; color: ${isDarkTheme ? '#e4e4e4' : '#333'};">
            <h2 style="margin-top: 0; color: ${isDarkTheme ? '#ff6b6b' : '#d32f2f'};">Schema Visualization Error</h2>
            <p style="line-height: 1.5;">${message}</p>
            <p style="margin-top: 20px; font-size: 0.9em;">You can try refreshing the visualizer after making changes to your schema.</p>
          </div>
        </div>
      `;
    }
  }
  
  debugLog("Starting schema visualization...");
  
  try {
    // Check if JointJS is loaded
    if (typeof joint === 'undefined') {
      debugLog("Error: JointJS library not found");
      return;
    }
    
    debugLog(`JointJS version: ${joint.version || "unknown"}`);
    
    // Check if we have schema data
    if (!schemaModel || !schemaModel.types) {
      debugLog("Error: Schema model not available");
      displayErrorMessage("Schema model not available. Please try again later.");
      return;
    }
    
    // Check if schema model is empty
    if (Object.keys(schemaModel.types).length === 0) {
      debugLog("Warning: Schema model is empty");
      displayErrorMessage("No schema types were found. Please make sure you have a valid StepZen schema defined in your project.");
      return;
    }
    
    debugLog(`Schema has ${Object.keys(schemaModel.types).length} types`);
    
    // Get VSCode theme information
    const isDarkTheme = document.body.classList.contains('vscode-dark');
    
    // Initialize JointJS graph
    const graph = new joint.dia.Graph();
    
    // Create the paper (canvas) with theme-aware settings
    const paper = new joint.dia.Paper({
      el: document.getElementById('diagram'),
      model: graph,
      width: '100%',
      height: '100%',
      gridSize: 10,
      drawGrid: true,
      background: {
        color: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
      },
      interactive: { linkMove: false }
    });
    
    debugLog("Graph and paper created");
    
    // Define a standard type box
    joint.shapes.custom = {};
    joint.shapes.custom.TypeBox = joint.dia.Element.define('custom.TypeBox', {
      attrs: {
        root: {
          refWidth: '100%',
          refHeight: '100%',
        },
        body: {
          refWidth: '100%',
          refHeight: '100%',
          fill: isDarkTheme ? '#2d2d2d' : '#ffffff',
          stroke: isDarkTheme ? '#6b6b6b' : '#000000',
          strokeWidth: 1,
          rx: 5,
          ry: 5
        },
        header: {
          refWidth: '100%',
          height: 30,
          fill: isDarkTheme ? '#3d3d3d' : '#f5f5f5',
          stroke: isDarkTheme ? '#6b6b6b' : '#000000',
          strokeWidth: 1
        },
        typeName: {
          refX: '50%',
          refY: 15,
          fontSize: 16,
          fontWeight: 'bold',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fill: isDarkTheme ? '#ffffff' : '#000000'
        },
        divider: {
          refX: 0,
          refY: 30,
          refWidth: '100%',
          stroke: '#000000',
          strokeWidth: 1
        },
        '.field': {
          fontSize: 12,
          fontFamily: 'monospace',
          fill: '#333',
          textAnchor: 'start',
          textVerticalAnchor: 'middle',
          pointerEvents: 'none'
        }
      },
      markup: [
        {
          tagName: 'rect',
          selector: 'body'
        },
        {
          tagName: 'rect',
          selector: 'header'
        },
        {
          tagName: 'text',
          selector: 'typeName'
        },
        {
          tagName: 'path',
          selector: 'divider'
        },
        {
          tagName: 'foreignObject',
          selector: 'fields',
          attributes: {
            'class': 'fields-container'
          }
        }
      ]
    });
    
    // Sort types: root types first, then alphabetically
    const typeNames = Object.keys(schemaModel.types);
    const rootTypes = ['Query', 'Mutation', 'Subscription'];
    const rootTypeNames = rootTypes.filter(t => typeNames.includes(t));
    const otherTypeNames = typeNames
      .filter(t => !rootTypes.includes(t))
      .sort();
    
    const sortedTypeNames = [...rootTypeNames, ...otherTypeNames];
    
    // Calculate layout
    const PADDING = 100;  // Even more padding between elements
    const HEADER_HEIGHT = 30;
    const FIELD_HEIGHT = 20;
    const TYPE_WIDTH = 220;  // Slightly wider boxes for better readability
    const TYPE_HEIGHT_MIN = 150;
    const MIN_BOX_SPACING = 180; // Even larger spacing between type boxes
    
    // Adjust grid columns based on number of types (fewer columns for more types)
    let GRID_COLS = 4;
    const typeCount = sortedTypeNames.length;
    if (typeCount > 20) {
      GRID_COLS = 6;  // Use 6 columns for many types
    } else if (typeCount > 15) {
      GRID_COLS = 5;  // Use 5 columns for many types
    } else if (typeCount <= 8) {
      GRID_COLS = 3;  // Use 3 columns for fewer types
    } else if (typeCount <= 4) {
      GRID_COLS = 2;  // Use 2 columns for very few types
    }
    
    debugLog(`Processing ${sortedTypeNames.length} types`);
    
    // Create elements for each type
    sortedTypeNames.forEach((typeName, index) => {
      const typeInfo = schemaModel.types[typeName];
      const fields = schemaModel.fields[typeName] || [];
      
      debugLog(`Processing type ${typeName} with ${fields.length} fields`);
      
      // Calculate height based on number of fields (with minimum height)
      const height = Math.max(TYPE_HEIGHT_MIN, HEADER_HEIGHT + (fields.length * FIELD_HEIGHT) + PADDING/2);
      
      // Calculate type's position using a force-directed approach
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      
      // Create a more organic layout with variable spacing
      // Add more pronounced staggering to rows to create better visual separation
      const staggerX = (row % 2) * (TYPE_WIDTH / 3);
      // Use a much wider horizontal spacing for better readability
      const x = col * (TYPE_WIDTH + PADDING * 2) + PADDING + staggerX;
      
      // Use the actual height of each type to prevent vertical overlaps
      // Calculate the maximum height of all types in previous row
      let prevRowMaxHeight = TYPE_HEIGHT_MIN;
      if (row > 0) {
        // Look at all items in the previous row to find the tallest one
        const prevRowStart = (row - 1) * GRID_COLS;
        const prevRowEnd = Math.min(prevRowStart + GRID_COLS, sortedTypeNames.length);
        
        for (let i = prevRowStart; i < prevRowEnd; i++) {
          if (i >= sortedTypeNames.length) break;
          const prevTypeName = sortedTypeNames[i];
          const prevFields = schemaModel.fields[prevTypeName] || [];
          const prevHeight = Math.max(TYPE_HEIGHT_MIN, HEADER_HEIGHT + (prevFields.length * FIELD_HEIGHT) + PADDING/2);
          prevRowMaxHeight = Math.max(prevRowMaxHeight, prevHeight);
        }
      }
      
      // Accumulate y-position based on heights of previous rows
      let y = PADDING;
      for (let r = 0; r < row; r++) {
        // Find max height in this row
        let rowMaxHeight = TYPE_HEIGHT_MIN;
        const rowStart = r * GRID_COLS;
        const rowEnd = Math.min(rowStart + GRID_COLS, index);
        
        for (let i = rowStart; i < rowEnd; i++) {
          if (i >= sortedTypeNames.length) break;
          const rowTypeInfo = schemaModel.types[sortedTypeNames[i]];
          const rowFields = schemaModel.fields[sortedTypeNames[i]] || [];
          const rowHeight = Math.max(TYPE_HEIGHT_MIN, HEADER_HEIGHT + (rowFields.length * FIELD_HEIGHT) + PADDING/2);
          rowMaxHeight = Math.max(rowMaxHeight, rowHeight);
        }
        
        y += rowMaxHeight + MIN_BOX_SPACING;
      }
      
      // Create the type element
      const typeElement = new joint.shapes.custom.TypeBox({
        position: { x, y },
        size: { width: TYPE_WIDTH, height },
        attrs: {
          typeName: { text: typeName },
          divider: { d: `M 0 ${HEADER_HEIGHT} L ${TYPE_WIDTH} ${HEADER_HEIGHT}` }
        }
      });
      
      // Store type data for navigation
      typeElement.prop('typeData', {
        typeName: typeName,
        location: typeInfo.location
      });
      
      // Create a fields container element
      const fieldsDiv = document.createElement('div');
      fieldsDiv.style.width = '100%';
      fieldsDiv.style.height = '100%';
      fieldsDiv.style.paddingTop = '40px';
      fieldsDiv.style.paddingLeft = '15px';
      fieldsDiv.style.paddingRight = '15px';
      fieldsDiv.style.paddingBottom = '15px';
      fieldsDiv.style.overflow = 'hidden';
      fieldsDiv.style.boxSizing = 'border-box';
      fieldsDiv.style.color = isDarkTheme ? '#e4e4e4' : '#333333';
      
      // Add field elements
      fields.forEach((field, fieldIndex) => {
        const fieldText = `${field.name}: ${field.isList ? '[' : ''}${field.type}${field.isList ? ']' : ''}`;
        
        const fieldElem = document.createElement('div');
        fieldElem.textContent = fieldText;
        fieldElem.style.font = '12px monospace';
        fieldElem.style.color = isDarkTheme ? '#e4e4e4' : '#333333';
        fieldElem.style.cursor = 'pointer';
        fieldElem.style.marginBottom = '10px';
        fieldElem.style.whiteSpace = 'nowrap';
        fieldElem.style.overflow = 'hidden';
        fieldElem.style.textOverflow = 'ellipsis';
        fieldElem.style.padding = '2px 0';
        fieldElem.dataset.fieldIndex = fieldIndex;
        
        fieldsDiv.appendChild(fieldElem);
        
        // Store field location for navigation
        typeElement.prop(`field${fieldIndex}Data`, {
          fieldName: field.name,
          location: field.location
        });
      });
      
      // Set the fields content
      typeElement.attr('fields', {
        refWidth: '100%',
        refHeight: '100%',
        html: fieldsDiv.outerHTML
      });
      
      graph.addCell(typeElement);
    });
    
    debugLog("Creating relationship links");
    
    // Create links for relationships
    schemaModel.relationships.forEach(rel => {
      // Find the source and target elements
      const sourceElement = graph.getElements().find(el => el.prop('typeData')?.typeName === rel.fromType);
      const targetElement = graph.getElements().find(el => el.prop('typeData')?.typeName === rel.toType);
      
      if (sourceElement && targetElement) {
        // Use standard.Link with simpler configuration
        const link = new joint.shapes.standard.Link({
          source: { id: sourceElement.id },
          target: { id: targetElement.id },
          router: { 
                name: 'manhattan', 
                args: {
                  padding: 70,  // Very large padding to prevent line overlap with boxes
                  startDirections: ['right', 'bottom', 'top', 'left'],
                  endDirections: ['left', 'top', 'bottom', 'right'],
                  step: 30,     // Even larger step size for cleaner routing
                  maximumLoops: 4000,  // Allow even more attempts to find a valid path
                  excludeTypes: ['element'], // Don't route through other elements
                  excludeEnds: ['source', 'target'], // Don't route through source/target elements
                  fallbackRoute: function(vertices) {
                    // Add some fallback vertices if routing fails
                    return vertices.concat([
                      { x: vertices[0].x + 100, y: vertices[0].y + 100 },
                      { x: vertices[vertices.length-1].x - 100, y: vertices[vertices.length-1].y - 100 }
                    ]);
                  }
                }
              },
          connector: { name: 'rounded' },
          attrs: {
            line: {
              stroke: '#555555',
              strokeWidth: 2,
              strokeDasharray: '5 3',  // More visible dashed line
              targetMarker: {
                'type': 'path',
                'd': 'M 10 -5 0 0 10 5 z',
                'fill': '#555555'      // Match arrow color to line
              }
            }
          },
          labels: [
            {
              position: 0.5,
              attrs: {
                text: {
                  text: rel.fieldName,
                  fill: isDarkTheme ? '#ffffff' : '#333333',
                  fontSize: 11,
                  fontWeight: 'bold'
                },
                rect: {
                  fill: isDarkTheme ? '#3d3d3d' : 'white',
                  stroke: isDarkTheme ? '#6b6b6b' : '#999999',
                  strokeWidth: 1,
                  rx: 3,
                  ry: 3,
                  padding: 5
                }
              }
            }
          ]
        });
        
        graph.addCell(link);
      }
    });
    
    debugLog("All relationships created");
    
    // Function to navigate to a file location
    function navigateToLocation(location) {
      if (!location) return;
      
      vscode.postMessage({
        command: 'navigateToLocation',
        location: location
      });
    }
    
    // Click handler for type and field navigation
    paper.on('element:pointerclick', function(elementView, evt) {
      const element = elementView.model;
      
      // Check if the click was on a type header (for type navigation)
      const typeData = element.prop('typeData');
      if (!typeData) return;
      
      // Find the target element that was clicked
      const target = evt.target;
      
      // Check if it's a field (matches data-field-index attribute)
      if (target.hasAttribute && target.hasAttribute('data-field-index')) {
        const fieldIndex = target.getAttribute('data-field-index');
        const fieldData = element.prop(`field${fieldIndex}Data`);
        
        if (fieldData && fieldData.location) {
          navigateToLocation(fieldData.location);
        }
        return;
      }
      
      // Check if click was on header by position
      const position = paper.clientToLocalPoint({ x: evt.clientX, y: evt.clientY });
      const elementPosition = element.position();
      const relativeY = position.y - elementPosition.y;
      
      if (relativeY <= HEADER_HEIGHT && typeData.location) {
        navigateToLocation(typeData.location);
      }
    });
    
    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      const zoom = paper.scale();
      paper.scale(zoom.sx * 1.2, zoom.sy * 1.2);
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
      const zoom = paper.scale();
      paper.scale(zoom.sx / 1.2, zoom.sy / 1.2);
    });
    
    document.getElementById('reset').addEventListener('click', () => {
      paper.scale(0.8, 0.8);
      paper.translate(50, 30);
    });
    
    // Search functionality
    const searchInput = document.getElementById('search');
    let lastHighlightedElements = [];
    let currentHighlightIndex = 0;
    let debounceTimer;
    
    // Execute search with debouncing
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => performSearch(), 150);
    });
    
    // Add next/prev buttons next to search box if they don't exist
    if (!document.getElementById('search-next')) {
      const toolbar = document.getElementById('toolbar');
      const searchInput = document.getElementById('search');
      
      const nextButton = document.createElement('button');
      nextButton.id = 'search-next';
      nextButton.textContent = '↓';
      nextButton.title = 'Next match';
      nextButton.addEventListener('click', () => navigateSearch(1));
      
      const prevButton = document.createElement('button');
      prevButton.id = 'search-prev';
      prevButton.textContent = '↑';
      prevButton.title = 'Previous match';
      prevButton.addEventListener('click', () => navigateSearch(-1));
      
      // Insert buttons after search input
      searchInput.insertAdjacentElement('afterend', nextButton);
      searchInput.insertAdjacentElement('afterend', prevButton);
      
      // Add search count display
      const searchCount = document.createElement('span');
      searchCount.id = 'search-count';
      searchCount.style.padding = '0 8px';
      searchCount.style.fontSize = '12px';
      searchCount.style.minWidth = '80px';
      searchCount.style.display = 'none';
      toolbar.appendChild(searchCount);
    }
    
    // Function to perform the search
    function performSearch() {
      const searchTerm = searchInput.value.trim().toLowerCase();
      const searchCount = document.getElementById('search-count');
      
      // Reset previous highlights
      lastHighlightedElements.forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#000000');
        element.attr('body/strokeWidth', 1);
      });
      lastHighlightedElements = [];
      currentHighlightIndex = 0;
      
      // Reset all elements to normal appearance
      graph.getElements().forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#000000');
        element.attr('body/strokeWidth', 1);
        element.attr('body/fillOpacity', 1);
      });
      
      // Hide search count if no search term
      if (!searchTerm) {
        searchCount.style.display = 'none';
        return;
      }
      
      // Find matching elements
      const matchingElements = graph.getElements().filter(element => {
        const typeData = element.prop('typeData');
        if (!typeData) return false;
        
        // Check if type name matches
        const typeName = typeData.typeName.toLowerCase();
        if (typeName.includes(searchTerm)) return true;
        
        // Check if any field names match
        const fields = schemaModel.fields[typeData.typeName] || [];
        return fields.some(field => 
          field.name.toLowerCase().includes(searchTerm) || 
          field.type.toLowerCase().includes(searchTerm)
        );
      });
      
      // Highlight matching elements and dim others
      if (matchingElements.length > 0) {
        // Update search count
        searchCount.textContent = `${matchingElements.length} match${matchingElements.length === 1 ? '' : 'es'}`;
        searchCount.style.display = 'inline';
        
        // Dim non-matching elements
        graph.getElements().forEach(element => {
          if (!matchingElements.includes(element)) {
            element.attr('body/fillOpacity', 0.3);
          }
        });
        
        // Save all matches
        lastHighlightedElements = matchingElements;
        
        // Highlight and focus on the first match
        highlightAndFocusElement(matchingElements[0]);
      } else {
        // No matches found
        searchCount.textContent = 'No matches';
        searchCount.style.display = 'inline';
      }
    }
    
    // Function to navigate between search results
    function navigateSearch(direction) {
      if (lastHighlightedElements.length === 0) return;
      
      // Update current index
      currentHighlightIndex = (currentHighlightIndex + direction + lastHighlightedElements.length) % lastHighlightedElements.length;
      
      // Reset all highlights
      lastHighlightedElements.forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#000000');
        element.attr('body/strokeWidth', 1);
      });
      
      // Highlight and focus the current element
      highlightAndFocusElement(lastHighlightedElements[currentHighlightIndex]);
    }
    
    // Function to highlight and focus on an element
    function highlightAndFocusElement(element) {
      // Highlight the element
      const highlightColor = isDarkTheme ? '#4d9fff' : '#ff5722';
      element.attr('body/stroke', highlightColor);
      element.attr('body/strokeWidth', 3);
      
      // Scroll to the element
      const position = element.position();
      const size = element.size();
      
      paper.translate(
        (paper.el.clientWidth / 2) - (position.x + size.width / 2),
        (paper.el.clientHeight / 2) - (position.y + size.height / 2)
      );
    }
    
    // Add keyboard shortcuts for search navigation
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && document.activeElement === searchInput) {
        if (event.shiftKey) {
          navigateSearch(-1); // Previous match
        } else {
          navigateSearch(1);  // Next match
        }
      }
    });
    
    // Wait a moment for the graph to render before calculating dimensions
  setTimeout(() => {
    // Calculate the total graph dimensions
    const graphSize = graph.getBBox();
    
    // Get viewport dimensions
    const viewportWidth = paper.el.clientWidth;
    const viewportHeight = paper.el.clientHeight;
      
    // Add margins around the graph
    const marginX = viewportWidth * 0.15;
    const marginY = viewportHeight * 0.15;
      
    // Choose a scale that ensures most content is visible
    const scaleX = Math.min(0.9, (viewportWidth - marginX) / graphSize.width);
    const scaleY = Math.min(0.9, (viewportHeight - marginY) / graphSize.height);
      
    // Use a scale that ensures the entire graph fits, but don't make it too small
    // For very large graphs, we'll allow some scrolling rather than making everything tiny
    const scale = Math.max(0.35, Math.min(scaleX, scaleY, 0.85));
      
    // Check if we have lots of types that need more spacing
    const typeCount = sortedTypeNames.length;
    if (typeCount > 15) {
      // For very large schemas, scale a bit more aggressively
      paper.scale(Math.max(0.3, scale * 0.9), Math.max(0.3, scale * 0.9));
    } else {
      paper.scale(scale, scale);
    }
      
    // Center the graph in the view
    // Calculate centering translations with padding
    const initialTranslateX = (viewportWidth - graphSize.width * scale) / 2;
    const initialTranslateY = (viewportHeight - graphSize.height * scale) / 2;
      
    // Ensure we have a minimum offset from the top-left
    paper.translate(Math.max(80, initialTranslateX), Math.max(60, initialTranslateY));
      
    debugLog(`Graph scaled to ${scale.toFixed(2)} and centered`);
  }, 300); // Even longer delay to ensure all elements are rendered
    
    // Make the graph draggable
    let dragStartPosition = null;
    
    paper.on('blank:pointerdown', function(evt, x, y) {
      dragStartPosition = { x, y };
    });
    
    paper.on('blank:pointermove', function(evt, x, y) {
      if (dragStartPosition) {
        const tx = paper.translate();
        paper.translate(
          tx.tx + (x - dragStartPosition.x),
          tx.ty + (y - dragStartPosition.y)
        );
        dragStartPosition = { x, y };
      }
    });
    
    paper.on('blank:pointerup', function() {
      dragStartPosition = null;
    });
    
    // Focus on selected type if provided
    if (focusedType) {
      const focusedElement = graph.getElements().find(el => 
        el.prop('typeData')?.typeName === focusedType
      );
      
      if (focusedElement) {
        // Highlight and center on the focused element
        focusedElement.attr('body/stroke', '#ff0000');
        focusedElement.attr('body/strokeWidth', 2);
        
        const position = focusedElement.position();
        const size = focusedElement.size();
        
        paper.translate(
          (paper.el.clientWidth / 2) - (position.x + size.width / 2),
          (paper.el.clientHeight / 2) - (position.y + size.height / 2)
        );
      }
    }
    
    debugLog("Schema visualization completed successfully");
    
  } catch (error) {
    debugLog(`Error in schema visualization: ${error.message}`);
    console.error(error);
  }
})();