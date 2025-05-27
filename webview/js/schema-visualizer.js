/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

(function() {
  // vscode is now available globally from the HTML script
  
  function debugLog(message) {
    // Only send to VS Code output channel, not console
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
    if (!schemaModel) {
      debugLog("Error: Schema model is undefined");
      displayErrorMessage("Schema model not available. The extension may not have loaded the schema data correctly. Please try refreshing the visualizer.");
      return;
    }
    
    if (!schemaModel.types) {
      debugLog("Error: Schema model types property is missing");
      displayErrorMessage("Schema model is malformed (missing types property). Please try refreshing the visualizer.");
      return;
    }
    
    // Check if schema model is empty
    const schemaTypeCount = Object.keys(schemaModel.types).length;
    if (schemaTypeCount === 0) {
      debugLog("Warning: Schema model is empty");
      displayErrorMessage("No schema types were found. Please make sure you have a valid StepZen schema defined in your project with type definitions.");
      return;
    }
    
    debugLog(`Schema model loaded successfully with ${schemaTypeCount} types`);
    
    // Debug the actual schema model structure
    debugLog(`Schema model structure:`);
    debugLog(`- types: ${JSON.stringify(Object.keys(schemaModel.types))}`);
    debugLog(`- fields: ${JSON.stringify(Object.keys(schemaModel.fields))}`);
    debugLog(`- relationships: ${schemaModel.relationships.length}`);
    
    // Debug a sample type
    const firstTypeName = Object.keys(schemaModel.types)[0];
    if (firstTypeName) {
      debugLog(`Sample type ${firstTypeName}:`);
      debugLog(`- type info: ${JSON.stringify(schemaModel.types[firstTypeName])}`);
      debugLog(`- fields: ${JSON.stringify(schemaModel.fields[firstTypeName])}`);
    }
    
    // Get VSCode theme information
    const isDarkTheme = document.body.classList.contains('vscode-dark');
    
    // Initialize JointJS graph
    const graph = new joint.dia.Graph();
    
    // Create the paper (canvas) with better settings
    const paper = new joint.dia.Paper({
      el: document.getElementById('diagram'),
      model: graph,
      width: '100%',
      height: '100%',
      gridSize: 20,
      drawGrid: true,
      background: {
        color: isDarkTheme ? '#1e1e1e' : '#fafafa'
      },
      interactive: function(cellView) {
        // Allow interaction only for type boxes (not field labels)
        return cellView.model.prop('typeData') ? true : false;
      },
      defaultRouter: { name: 'orthogonal' },
      defaultConnector: { name: 'rounded' }
    });
    
    debugLog("Graph and paper created");
    
    // Constants for layout
    const TYPE_WIDTH = 280;
    const FIELD_HEIGHT = 18;
    const HEADER_HEIGHT = 35;
    const PADDING = 15;
    const MIN_TYPE_HEIGHT = 120;
    const BASE_SPACING_X = 350;
    const BASE_SPACING_Y = 200;
    const MIN_SPACING_BUFFER = 50;  // Minimum buffer between boxes
    
    // Sort types: root types first, then alphabetically
    const typeNames = Object.keys(schemaModel.types);
    const rootTypes = ['Query', 'Mutation', 'Subscription'];
    const rootTypeNames = rootTypes.filter(t => typeNames.includes(t));
    const otherTypeNames = typeNames
      .filter(t => !rootTypes.includes(t))
      .sort();
    
    const sortedTypeNames = [...rootTypeNames, ...otherTypeNames];
    
    // Calculate grid layout
    const GRID_COLS = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(sortedTypeNames.length))));
    
    debugLog(`Processing ${sortedTypeNames.length} types in ${GRID_COLS} columns`);
    
    // First pass: calculate all type heights for better layout
    const typeHeights = new Map();
    sortedTypeNames.forEach(typeName => {
      const fields = schemaModel.fields[typeName] || [];
      const fieldsHeight = Math.max(fields.length * FIELD_HEIGHT, 60);
      const totalHeight = Math.max(MIN_TYPE_HEIGHT, HEADER_HEIGHT + fieldsHeight + PADDING * 2);
      typeHeights.set(typeName, totalHeight);
    });
    
    // Calculate dynamic row heights for better spacing
    const rowHeights = [];
    for (let row = 0; row < Math.ceil(sortedTypeNames.length / GRID_COLS); row++) {
      let maxHeightInRow = MIN_TYPE_HEIGHT;
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col;
        if (index < sortedTypeNames.length) {
          const typeName = sortedTypeNames[index];
          maxHeightInRow = Math.max(maxHeightInRow, typeHeights.get(typeName));
        }
      }
      rowHeights.push(maxHeightInRow);
    }
    
    // Create elements for each type
    const typeElements = new Map();
    
    sortedTypeNames.forEach((typeName, index) => {
      const typeInfo = schemaModel.types[typeName];
      const fields = schemaModel.fields[typeName] || [];
      
      debugLog(`Processing type ${typeName} with ${fields.length} fields`);
      
      // Calculate position with dynamic spacing
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      const x = col * (TYPE_WIDTH + BASE_SPACING_X) + 50;
      
      // Calculate y position based on previous row heights
      let y = 50;
      for (let r = 0; r < row; r++) {
        y += rowHeights[r] + MIN_SPACING_BUFFER;
      }
      
      // Get the calculated height for this type
      const totalHeight = typeHeights.get(typeName);
      
      // Create type element using standard rectangle
      const typeElement = new joint.shapes.standard.Rectangle({
        position: { x, y },
        size: { width: TYPE_WIDTH, height: totalHeight },
        attrs: {
          root: {
            title: typeName
          },
          body: {
            fill: isDarkTheme ? '#2d2d2d' : '#ffffff',
            stroke: isDarkTheme ? '#6b6b6b' : '#333333',
            strokeWidth: 2,
            rx: 8,
            ry: 8
          },
          label: {
            text: typeName,
            fontSize: 16,
            fontWeight: 'bold',
            fill: isDarkTheme ? '#ffffff' : '#000000',
            textAnchor: 'middle',
            textVerticalAnchor: 'top',
            y: 10
          }
        }
      });
      
              // Store type data for navigation
        typeElement.prop('typeData', {
          typeName: typeName,
          location: typeInfo.location,
          fields: fields
        });
        
        // Add to graph
        graph.addCell(typeElement);
        typeElements.set(typeName, typeElement);
      
                      // Store field elements for this type
        const fieldElements = [];
        
        // Create field labels as separate text elements
        fields.forEach((field, fieldIndex) => {
          const fieldText = `${field.name}: ${field.isList ? '[' : ''}${field.type}${field.isList ? ']' : ''}`;
          const fieldY = y + HEADER_HEIGHT + (fieldIndex * FIELD_HEIGHT) + 10;
          
          const fieldElement = new joint.shapes.standard.TextBlock({
            position: { x: x + 10, y: fieldY },
            size: { width: TYPE_WIDTH - 20, height: FIELD_HEIGHT },
            attrs: {
              body: {
                fill: 'transparent',
                stroke: 'none'
              },
              label: {
                text: fieldText,
                fontSize: 12,
                fontFamily: 'Monaco, Menlo, monospace',
                fill: isDarkTheme ? '#e4e4e4' : '#333333',
                textAnchor: 'start',
                textVerticalAnchor: 'middle'
              }
            }
          });
          
          // Store field data for navigation
          fieldElement.prop('fieldData', {
            fieldName: field.name,
            location: field.location,
            parentType: typeName,
            parentTypeElement: typeElement,
            relativePosition: { x: 10, y: HEADER_HEIGHT + (fieldIndex * FIELD_HEIGHT) + 10 }
          });
          
          fieldElements.push(fieldElement);
          graph.addCell(fieldElement);
        });
        
        // Store field elements in the type element for easy access
        typeElement.prop('fieldElements', fieldElements);
    });
    
    debugLog("Creating relationship links");
    
    // Create links for relationships
    schemaModel.relationships.forEach(rel => {
      const sourceElement = typeElements.get(rel.fromType);
      const targetElement = typeElements.get(rel.toType);
      
      if (sourceElement && targetElement) {
        const link = new joint.shapes.standard.Link({
          source: { id: sourceElement.id },
          target: { id: targetElement.id },
          router: { name: 'orthogonal' },
          connector: { name: 'rounded' },
          attrs: {
            line: {
              stroke: isDarkTheme ? '#888888' : '#666666',
              strokeWidth: 2,
              strokeDasharray: '5,5',
              targetMarker: {
                'type': 'path',
                'd': 'M 10 -5 0 0 10 5 z',
                'fill': isDarkTheme ? '#888888' : '#666666'
              }
            }
          },
          labels: [{
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
                ry: 3
              }
            }
          }]
        });
        
        graph.addCell(link);
      }
    });
    
    debugLog("All relationships created");
    
    // Handle type box movement - move field elements with their parent
    graph.on('change:position', function(element) {
      const typeData = element.prop('typeData');
      if (typeData) {
        // This is a type element that moved
        const fieldElements = element.prop('fieldElements') || [];
        const newPosition = element.position();
        
        fieldElements.forEach(fieldElement => {
          const fieldData = fieldElement.prop('fieldData');
          if (fieldData && fieldData.relativePosition) {
            const newFieldPosition = {
              x: newPosition.x + fieldData.relativePosition.x,
              y: newPosition.y + fieldData.relativePosition.y
            };
            fieldElement.position(newFieldPosition.x, newFieldPosition.y);
          }
        });
      }
    });
    
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
      
      // Check for field data first
      const fieldData = element.prop('fieldData');
      if (fieldData && fieldData.location) {
        navigateToLocation(fieldData.location);
        return;
      }
      
      // Check for type data
      const typeData = element.prop('typeData');
      if (typeData && typeData.location) {
        navigateToLocation(typeData.location);
        return;
      }
    });
    
    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      const currentScale = paper.scale();
      paper.scale(currentScale.sx * 1.2, currentScale.sy * 1.2);
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
      const currentScale = paper.scale();
      paper.scale(currentScale.sx / 1.2, currentScale.sy / 1.2);
    });
    
    document.getElementById('reset').addEventListener('click', () => {
      paper.scale(1, 1);
      paper.translate(0, 0);
      
      // Clear search
      searchInput.value = '';
      searchResults = [];
      currentSearchIndex = 0;
      const searchCount = document.getElementById('search-count');
      if (searchCount) {
        searchCount.style.display = 'none';
      }
      
      // Reset all element styles
      graph.getElements().forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#333333');
        element.attr('body/strokeWidth', 2);
        element.attr('body/fillOpacity', 1);
        element.attr('body/filter', null);
      });
    });
    
    // Refresh functionality
    document.getElementById('refresh').addEventListener('click', () => {
      debugLog('Refresh button clicked');
      vscode.postMessage({
        command: 'refresh-schema',
        message: 'User requested schema refresh'
      });
    });
    
    // Simple panning implementation
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let startTranslate = { tx: 0, ty: 0 };
    
    paper.on('blank:pointerdown', function(evt) {
      isPanning = true;
      startPoint = { x: evt.clientX, y: evt.clientY };
      startTranslate = paper.translate();
      paper.el.style.cursor = 'grabbing';
    });
    
    document.addEventListener('pointermove', function(evt) {
      if (!isPanning) return;
      
      const dx = evt.clientX - startPoint.x;
      const dy = evt.clientY - startPoint.y;
      
      paper.translate(startTranslate.tx + dx, startTranslate.ty + dy);
    });
    
    document.addEventListener('pointerup', function() {
      if (isPanning) {
        isPanning = false;
        paper.el.style.cursor = 'default';
      }
    });
    
    // Mouse wheel zoom
    paper.el.addEventListener('wheel', function(evt) {
      evt.preventDefault();
      
      const currentScale = paper.scale();
      const delta = evt.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
      const newScale = Math.max(0.1, Math.min(3, currentScale.sx * delta)); // Limit zoom range
      
      // Get mouse position relative to paper
      const rect = paper.el.getBoundingClientRect();
      const mouseX = evt.clientX - rect.left;
      const mouseY = evt.clientY - rect.top;
      
      // Calculate zoom center point
      const currentTranslate = paper.translate();
      const zoomCenterX = (mouseX - currentTranslate.tx) / currentScale.sx;
      const zoomCenterY = (mouseY - currentTranslate.ty) / currentScale.sy;
      
      // Apply zoom
      paper.scale(newScale, newScale);
      
      // Adjust translation to keep zoom centered on mouse
      const newTranslateX = mouseX - zoomCenterX * newScale;
      const newTranslateY = mouseY - zoomCenterY * newScale;
      paper.translate(newTranslateX, newTranslateY);
    });
    
    // Search functionality
    const searchInput = document.getElementById('search');
    let searchResults = [];
    let currentSearchIndex = 0;
    
    // Add search navigation buttons
    if (!document.getElementById('search-next')) {
      const toolbar = document.getElementById('toolbar');
      const searchContainer = searchInput.parentElement;
      
      const nextButton = document.createElement('button');
      nextButton.id = 'search-next';
      nextButton.textContent = '↓';
      nextButton.title = 'Next match';
      
      const prevButton = document.createElement('button');
      prevButton.id = 'search-prev';
      prevButton.textContent = '↑';
      prevButton.title = 'Previous match';
      
      const searchCount = document.createElement('span');
      searchCount.id = 'search-count';
      searchCount.style.display = 'none';
      
      searchContainer.appendChild(prevButton);
      searchContainer.appendChild(nextButton);
      searchContainer.appendChild(searchCount);
      
      nextButton.addEventListener('click', () => navigateSearch(1));
      prevButton.addEventListener('click', () => navigateSearch(-1));
    }
    
    function performSearch() {
      const searchTerm = searchInput.value.trim().toLowerCase();
      const searchCount = document.getElementById('search-count');
      
      // Reset previous highlights
      graph.getElements().forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#333333');
        element.attr('body/strokeWidth', 2);
        element.attr('body/fillOpacity', 1);
        element.attr('body/filter', null); // Remove any glow effects
      });
      
      if (!searchTerm) {
        searchResults = [];
        searchCount.style.display = 'none';
        return;
      }
      
      // Find matching elements
      searchResults = graph.getElements().filter(element => {
        const typeData = element.prop('typeData');
        const fieldData = element.prop('fieldData');
        
        if (typeData) {
          const typeName = typeData.typeName.toLowerCase();
          if (typeName.includes(searchTerm)) return true;
          
          const fields = typeData.fields || [];
          return fields.some(field => 
            field.name.toLowerCase().includes(searchTerm) || 
            field.type.toLowerCase().includes(searchTerm)
          );
        }
        
        if (fieldData) {
          return fieldData.fieldName.toLowerCase().includes(searchTerm);
        }
        
        return false;
      });
      
      if (searchResults.length > 0) {
        searchCount.textContent = `${searchResults.length} match${searchResults.length === 1 ? '' : 'es'}`;
        searchCount.style.display = 'inline';
        currentSearchIndex = 0;
        highlightSearchResult(0);
      } else {
        searchCount.textContent = 'No matches';
        searchCount.style.display = 'inline';
      }
    }
    
    function navigateSearch(direction) {
      if (searchResults.length === 0) return;
      
      currentSearchIndex = (currentSearchIndex + direction + searchResults.length) % searchResults.length;
      highlightSearchResult(currentSearchIndex);
    }
    
    function highlightSearchResult(index) {
      if (index < 0 || index >= searchResults.length) return;
      
      // Reset all highlights and filters
      graph.getElements().forEach(element => {
        element.attr('body/stroke', isDarkTheme ? '#6b6b6b' : '#333333');
        element.attr('body/strokeWidth', 2);
        element.attr('body/fillOpacity', 1);
        element.attr('body/filter', null);
      });
      
      // Dim all non-matching elements
      graph.getElements().forEach(element => {
        if (!searchResults.includes(element)) {
          element.attr('body/fillOpacity', 0.3);
        }
      });
      
      // Only highlight the current result (not all matches)
      const currentElement = searchResults[index];
      currentElement.attr('body/stroke', '#ff5722');
      currentElement.attr('body/strokeWidth', 4);
      currentElement.attr('body/fillOpacity', 1);
      
      // Add a subtle glow effect to current result
      currentElement.attr('body/filter', 'drop-shadow(0 0 8px rgba(255, 87, 34, 0.6))');
      
      // Center on current element
      const bbox = currentElement.getBBox();
      const paperSize = paper.getComputedSize();
      const scale = paper.scale();
      
      const tx = (paperSize.width / 2) - (bbox.x + bbox.width / 2) * scale.sx;
      const ty = (paperSize.height / 2) - (bbox.y + bbox.height / 2) * scale.sy;
      
      paper.translate(tx, ty);
      
      // Update search count to show current position
      const searchCount = document.getElementById('search-count');
      if (searchCount) {
        searchCount.textContent = `${index + 1} of ${searchResults.length}`;
      }
    }
    
    // Search input event
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(performSearch, 300);
    });
    
    // Keyboard shortcuts
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (event.shiftKey) {
          navigateSearch(-1);
        } else {
          navigateSearch(1);
        }
        event.preventDefault();
      }
    });
    
    // Initial layout and scaling
    setTimeout(() => {
      const bbox = graph.getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        const paperSize = paper.getComputedSize();
        const padding = 100;
        
        const scaleX = (paperSize.width - padding) / bbox.width;
        const scaleY = (paperSize.height - padding) / bbox.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        paper.scale(scale, scale);
        
        const scaledBBox = {
          width: bbox.width * scale,
          height: bbox.height * scale
        };
        
        const tx = (paperSize.width - scaledBBox.width) / 2 - bbox.x * scale;
        const ty = (paperSize.height - scaledBBox.height) / 2 - bbox.y * scale;
        
        paper.translate(tx, ty);
        
        debugLog(`Initial layout: scale=${scale.toFixed(2)}, translate=(${tx.toFixed(0)}, ${ty.toFixed(0)})`);
      }
    }, 100);
    
    // Focus on selected type if provided
    if (focusedType) {
      setTimeout(() => {
        const focusedElement = typeElements.get(focusedType);
        if (focusedElement) {
          focusedElement.attr('body/stroke', '#ff0000');
          focusedElement.attr('body/strokeWidth', 4);
          
          const bbox = focusedElement.getBBox();
          const paperSize = paper.getComputedSize();
          const scale = paper.scale();
          
          const tx = (paperSize.width / 2) - (bbox.x + bbox.width / 2) * scale.sx;
          const ty = (paperSize.height / 2) - (bbox.y + bbox.height / 2) * scale.sy;
          
          paper.translate(tx, ty);
        }
      }, 200);
    }
    
    debugLog("Schema visualization completed successfully");
    
      } catch (error) {
      debugLog(`Error in schema visualization: ${error.message}`);
      displayErrorMessage(`Visualization error: ${error.message}`);
    }
})();