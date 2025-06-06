/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

(function() {
  function debugLog(message) {
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
  
  debugLog("Starting clean D3-based schema visualization...");
  
  try {
    if (typeof schemaModel === 'undefined' || !schemaModel) {
      displayErrorMessage("Schema data is not available. Please ensure you have a valid StepZen project open.");
      return;
    }
    
    const isDarkTheme = document.body.classList.contains('vscode-dark');
    debugLog(`Theme detected: ${isDarkTheme ? 'dark' : 'light'}`);
    
    const container = document.getElementById('diagram');
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width || 1200;
    const height = containerRect.height || 800;
    
    debugLog(`Container dimensions: ${width}x${height}`);
    
    // Clear and create SVG
    container.innerHTML = '';
    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background-color', isDarkTheme ? '#1e1e1e' : '#fafafa');
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    const g = svg.append('g');
    
    // Create groups in proper z-order (bottom to top)
    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const linkLabelGroup = g.append('g').attr('class', 'link-labels');
    
    // Constants
    const TYPE_WIDTH = 280;
    const FIELD_HEIGHT = 18;
    const HEADER_HEIGHT = 35;
    const PADDING = 15;
    const MIN_TYPE_HEIGHT = 120;
    
    // Connection constants
    const STRAIGHT_LINE_LENGTH = 15;
    const CONTROL_OFFSET_RATIO = 0.3;
    const MIN_CONTROL_OFFSET = 60;
    const LABEL_POSITION_RATIO = 0.25;
    const AUTO_FIT_PADDING = 150;
    const AUTO_FIT_MAX_SCALE = 0.6;
    
    // Visual constants
    const FIELD_BOX_PADDING = 2;
    const CONNECTION_STROKE_WIDTH = 2.5;
    const CONNECTION_OPACITY = 0.8;
    const HOVER_TRANSITION_DURATION = 150;
    
    // Process data - exclude scalar types to reduce clutter
    const typeNames = Object.keys(schemaModel.types || {});
    const referencedTypes = new Set();
    (schemaModel.relationships || []).forEach(rel => {
      referencedTypes.add(rel.fromType);
      referencedTypes.add(rel.toType);
    });
    
    // Filter out scalar types to reduce visual clutter
    const allTypeNames = Array.from(new Set([...typeNames, ...referencedTypes]))
      .filter(typeName => {
        const fields = schemaModel.fields[typeName] || [];
        const isRootType = ['Query', 'Mutation', 'Subscription'].includes(typeName);
        // Keep root types and types with fields (exclude scalars)
        return isRootType || fields.length > 0;
      });
    
    if (allTypeNames.length === 0) {
      displayErrorMessage("No types found in schema.");
      return;
    }
    
    debugLog(`Processing ${allTypeNames.length} types (scalars filtered out)`);
    
    // Create nodes - no scalar types
    const nodes = allTypeNames.map(typeName => {
      const typeInfo = schemaModel.types[typeName] || {};
      const fields = schemaModel.fields[typeName] || [];
      const isRootType = ['Query', 'Mutation', 'Subscription'].includes(typeName);
      
      const typeHeight = Math.max(MIN_TYPE_HEIGHT, HEADER_HEIGHT + fields.length * FIELD_HEIGHT + PADDING * 2);
      
      return {
        id: typeName,
        typeName: typeName,
        fields: fields,
        isRoot: isRootType,
        width: TYPE_WIDTH,
        height: typeHeight,
        location: typeInfo.location,
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: height / 2 + (Math.random() - 0.5) * 200
      };
    });
    
    // Create links - only between non-scalar types
    const links = (schemaModel.relationships || [])
      .filter(rel => allTypeNames.includes(rel.fromType) && allTypeNames.includes(rel.toType))
      .map(rel => ({
        source: rel.fromType,
        target: rel.toType,
        fieldName: rel.fieldName
      }));
    
    debugLog(`Created ${nodes.length} nodes and ${links.length} links`);
    
    // Force simulation with improved collision detection
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(180).strength(0.2))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force('collision', d3.forceCollide().radius(d => Math.max(d.width, d.height) / 2 + 30).strength(0.9))
      .alphaDecay(0.03)
      .velocityDecay(0.4);
    
    // Stop simulation after initial layout to prevent redrawing on drag
    let simulationStopped = false;
    simulation.on('end', () => {
      if (!simulationStopped) {
        simulationStopped = true;
        debugLog("Initial simulation completed - stopping auto-restart");
        
        // Auto-fit with padding after initial layout
        setTimeout(() => {
          autoFitWithPadding();
        }, 100);
      }
    });
    
    // Create links - field-to-type connections with curves and labels
    const link = linkGroup.selectAll('path')
      .data(links)
      .enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', isDarkTheme ? '#ff6b35' : '#e74c3c')
      .attr('stroke-width', CONNECTION_STROKE_WIDTH)
      .attr('stroke-opacity', CONNECTION_OPACITY)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('marker-start', 'url(#startpoint)');
    
    // Add labels to connections
    const linkLabels = linkLabelGroup.selectAll('text')
      .data(links)
      .enter().append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', isDarkTheme ? '#ffffff' : '#2c3e50')
      .attr('stroke', isDarkTheme ? '#1e1e1e' : '#ffffff')
      .attr('stroke-width', 2)
      .attr('paint-order', 'stroke')
      .text(d => d.fieldName || '');
    
    // Create markers
    const defs = svg.append('defs');
    
    // Open arrowhead marker (easier to see)
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', 'none')
      .attr('stroke', isDarkTheme ? '#ff6b35' : '#e74c3c')
      .attr('stroke-width', 2);
    
    // Start point marker (small circle)
    defs.append('marker')
      .attr('id', 'startpoint')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 0)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('circle')
      .attr('cx', 4)
      .attr('cy', 0)
      .attr('r', 3)
      .attr('fill', isDarkTheme ? '#ff6b35' : '#e74c3c');
    
    // Auto-fit function with more generous padding
    function autoFitWithPadding() {
      if (nodes.length === 0) return;
      
      // Calculate bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      nodes.forEach(node => {
        if (!node) return;
        const left = (node.x || 0) - (node.width || TYPE_WIDTH) / 2;
        const right = (node.x || 0) + (node.width || TYPE_WIDTH) / 2;
        const top = (node.y || 0) - (node.height || MIN_TYPE_HEIGHT) / 2;
        const bottom = (node.y || 0) + (node.height || MIN_TYPE_HEIGHT) / 2;
        
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
      });
      
      // Add more generous padding
      minX -= AUTO_FIT_PADDING;
      maxX += AUTO_FIT_PADDING;
      minY -= AUTO_FIT_PADDING;
      maxY += AUTO_FIT_PADDING;
      
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      
      // Calculate scale to fit with more breathing room
      const scaleX = width / contentWidth;
      const scaleY = height / contentHeight;
      const scale = Math.min(scaleX, scaleY, AUTO_FIT_MAX_SCALE);
      
      // Calculate translation to center content
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const tx = (width / 2) - (centerX * scale);
      const ty = (height / 2) - (centerY * scale);
      
      // Apply transform
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      
      debugLog(`Auto-fit applied: scale=${scale.toFixed(3)}, padding=${AUTO_FIT_PADDING}px`);
    }
    
    // Function to calculate field position for connections with dual attachment points
    function getFieldPosition(typeName, fieldName, targetPos) {
      const node = nodes.find(n => n.typeName === typeName);
      if (!node || !node.fields) return { x: 0, y: 0 };
      
      const fieldIndex = node.fields.findIndex(f => f && f.name === fieldName);
      if (fieldIndex === -1) return { x: node.x || 0, y: node.y || 0 }; // Default to type center
      
      // Calculate field Y position
      const fieldY = (node.y || 0) - (node.height || MIN_TYPE_HEIGHT) / 2 + HEADER_HEIGHT + (fieldIndex * FIELD_HEIGHT) + FIELD_HEIGHT / 2 + 5;
      
      // Choose left or right attachment point based on target position
      const leftX = (node.x || 0) - (node.width || TYPE_WIDTH) / 2 + FIELD_BOX_PADDING;
      const rightX = (node.x || 0) + (node.width || TYPE_WIDTH) / 2 - FIELD_BOX_PADDING;
      
      // If target is to the right, use right attachment; if to the left, use left attachment
      const fieldX = targetPos && targetPos.x > (node.x || 0) ? rightX : leftX;
      
      return { x: fieldX, y: fieldY };
    }
    
    // Function to calculate optimal type header attachment point
    function getTypeHeaderPosition(typeName, sourcePos) {
      const node = nodes.find(n => n.typeName === typeName);
      if (!node) return { x: 0, y: 0 };
      
      const headerY = (node.y || 0) - (node.height || MIN_TYPE_HEIGHT) / 2 + HEADER_HEIGHT / 2;
      
      // Choose left or right attachment point based on source position
      const leftX = (node.x || 0) - (node.width || TYPE_WIDTH) / 2;
      const rightX = (node.x || 0) + (node.width || TYPE_WIDTH) / 2;
      
      // If source is to the left, use left attachment; if to the right, use right attachment
      const headerX = sourcePos && sourcePos.x < (node.x || 0) ? leftX : rightX;
      
      return { x: headerX, y: headerY };
    }
    
    // Function to calculate connection path with curves and dual attachment points
    function calculateConnectionPath(d) {
      const sourceNode = nodes.find(n => n.typeName === (d.source.id || d.source));
      const targetNode = nodes.find(n => n.typeName === (d.target.id || d.target));
      
      if (!sourceNode || !targetNode || !d.fieldName) return '';
      
      // First pass: get rough target position to determine source attachment
      const roughTargetPos = {
        x: targetNode.x || 0,
        y: (targetNode.y || 0) - (targetNode.height || MIN_TYPE_HEIGHT) / 2 + HEADER_HEIGHT / 2
      };
      
      // Get optimal field position based on target
      const sourcePos = getFieldPosition(sourceNode.typeName, d.fieldName, roughTargetPos);
      
      // Get optimal type header position based on source
      const targetPos = getTypeHeaderPosition(targetNode.typeName, sourcePos);
      
      // Validate positions
      if (!sourcePos || !targetPos) return '';
      
      // Calculate control points for smooth curve with minimum straight line at end
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) return ''; // Avoid division by zero
      
      // Ensure at least STRAIGHT_LINE_LENGTH px straight line before the arrowhead
      const angle = Math.atan2(dy, dx);
      const adjustedTargetX = targetPos.x - Math.cos(angle) * STRAIGHT_LINE_LENGTH;
      const adjustedTargetY = targetPos.y - Math.sin(angle) * STRAIGHT_LINE_LENGTH;
      
      // Create curved path with better routing
      const controlOffset = Math.max(distance * CONTROL_OFFSET_RATIO, MIN_CONTROL_OFFSET);
      
      // Determine curve direction based on attachment points
      const sourceIsLeft = sourcePos.x < (sourceNode.x || 0);
      const targetIsLeft = targetPos.x < (targetNode.x || 0);
      
      // Control points that curve outward from attachment points
      const controlX1 = sourceIsLeft ? sourcePos.x - controlOffset * 0.5 : sourcePos.x + controlOffset * 0.5;
      const controlY1 = sourcePos.y;
      const controlX2 = targetIsLeft ? adjustedTargetX - controlOffset * 0.5 : adjustedTargetX + controlOffset * 0.5;
      const controlY2 = adjustedTargetY;
      
      return `M${sourcePos.x},${sourcePos.y} C${controlX1},${controlY1} ${controlX2},${controlY2} ${adjustedTargetX},${adjustedTargetY} L${targetPos.x},${targetPos.y}`;
    }
    
    // Function to calculate label position along the curve
    function calculateLabelPosition(d) {
      const sourceNode = nodes.find(n => n.typeName === (d.source.id || d.source));
      const targetNode = nodes.find(n => n.typeName === (d.target.id || d.target));
      
      if (!sourceNode || !targetNode || !d.fieldName) return { x: 0, y: 0 };
      
      // Use the same logic as calculateConnectionPath to get actual positions
      const roughTargetPos = {
        x: targetNode.x || 0,
        y: (targetNode.y || 0) - (targetNode.height || MIN_TYPE_HEIGHT) / 2 + HEADER_HEIGHT / 2
      };
      
      const sourcePos = getFieldPosition(sourceNode.typeName, d.fieldName, roughTargetPos);
      const targetPos = getTypeHeaderPosition(targetNode.typeName, sourcePos);
      
      if (!sourcePos || !targetPos) return { x: 0, y: 0 };
      
      // Calculate the adjusted target position (before the straight line)
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) return { x: sourcePos.x, y: sourcePos.y };
      
      const angle = Math.atan2(dy, dx);
      const adjustedTargetX = targetPos.x - Math.cos(angle) * STRAIGHT_LINE_LENGTH;
      const adjustedTargetY = targetPos.y - Math.sin(angle) * STRAIGHT_LINE_LENGTH;
      
      // Position label at LABEL_POSITION_RATIO along the curve
      const t = LABEL_POSITION_RATIO;
      const controlOffset = Math.max(distance * CONTROL_OFFSET_RATIO, MIN_CONTROL_OFFSET);
      const sourceIsLeft = sourcePos.x < (sourceNode.x || 0);
      const targetIsLeft = targetPos.x < (targetNode.x || 0);
      
      const controlX1 = sourceIsLeft ? sourcePos.x - controlOffset * 0.5 : sourcePos.x + controlOffset * 0.5;
      const controlY1 = sourcePos.y;
      const controlX2 = targetIsLeft ? adjustedTargetX - controlOffset * 0.5 : adjustedTargetX + controlOffset * 0.5;
      const controlY2 = adjustedTargetY;
      
      // Calculate point on cubic bezier curve
      const x = Math.pow(1-t, 3) * sourcePos.x + 
                3 * Math.pow(1-t, 2) * t * controlX1 + 
                3 * (1-t) * Math.pow(t, 2) * controlX2 + 
                Math.pow(t, 3) * adjustedTargetX;
      
      const y = Math.pow(1-t, 3) * sourcePos.y + 
                3 * Math.pow(1-t, 2) * t * controlY1 + 
                3 * (1-t) * Math.pow(t, 2) * controlY2 + 
                Math.pow(t, 3) * adjustedTargetY;
      
      return { x, y };
    }
    
    // Create nodes
    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Type boxes - main container
    node.append('rect')
      .attr('class', 'type-box')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('x', d => -d.width / 2)
      .attr('y', d => -d.height / 2)
      .attr('rx', 8)
      .attr('fill', isDarkTheme ? '#2d2d2d' : '#ffffff')
      .attr('stroke', isDarkTheme ? '#6b6b6b' : '#333333')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Header section for all types
    node.append('rect')
      .attr('class', 'type-header')
      .attr('width', d => d.width)
      .attr('height', HEADER_HEIGHT)
      .attr('x', d => -d.width / 2)
      .attr('y', d => -d.height / 2)
      .attr('rx', 8)
      .attr('fill', d => {
        if (d.isRoot) return isDarkTheme ? '#2d4a2d' : '#e8f5e8';
        return isDarkTheme ? '#3d3d3d' : '#f5f5f5';
      })
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Type names
    node.append('text')
      .attr('class', 'type-name')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', d => -d.height / 2 + HEADER_HEIGHT / 2)
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', d => {
        if (d.isRoot) return isDarkTheme ? '#7dd87d' : '#2d7a2d';
        return isDarkTheme ? '#ffffff' : '#000000';
      })
      .text(d => d.typeName)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Field separator line for types with fields
    node.filter(d => d.fields.length > 0)
      .append('line')
      .attr('class', 'field-separator')
      .attr('x1', d => -d.width / 2 + 5)
      .attr('x2', d => d.width / 2 - 5)
      .attr('y1', d => -d.height / 2 + HEADER_HEIGHT)
      .attr('y2', d => -d.height / 2 + HEADER_HEIGHT)
      .attr('stroke', isDarkTheme ? '#555555' : '#cccccc')
      .attr('stroke-width', 1);
    
    // Field groups for types with fields
    const fieldGroups = node.filter(d => d.fields.length > 0)
      .selectAll('.field-group')
      .data(d => d.fields.map((field, i) => ({ 
        ...field, 
        parentType: d.typeName, 
        parentNode: d,
        index: i,
        yOffset: -d.height / 2 + HEADER_HEIGHT + (i * FIELD_HEIGHT) + FIELD_HEIGHT / 2 + 5
      })))
      .enter().append('g')
      .attr('class', 'field-group')
      .style('cursor', 'pointer');
    
    // Field background rectangles (for hover effects and connection points)
    fieldGroups.append('rect')
      .attr('class', 'field-bg')
      .attr('x', d => -d.parentNode.width / 2 + 2)
      .attr('y', d => d.yOffset - FIELD_HEIGHT / 2)
      .attr('width', d => d.parentNode.width - 4)
      .attr('height', FIELD_HEIGHT)
      .attr('fill', 'transparent')
      .attr('stroke', isDarkTheme ? '#555555' : '#cccccc')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.2)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr('fill', isDarkTheme ? '#404040' : '#f0f0f0')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 2);
      })
      .on('mouseleave', function(event, d) {
        d3.select(this)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr('fill', 'transparent')
          .attr('stroke-opacity', 0.2)
          .attr('stroke-width', 1);
      })
      .on('click', function(event, d) {
        event.stopPropagation(); // Prevent type click
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Field names
    fieldGroups.append('text')
      .attr('class', 'field-name')
      .attr('x', d => -d.parentNode.width / 2 + 10)
      .attr('y', d => d.yOffset)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-family', 'Monaco, Menlo, monospace')
      .attr('font-weight', '500')
      .attr('fill', isDarkTheme ? '#e4e4e4' : '#333333')
      .text(d => d.name)
      .on('click', function(event, d) {
        event.stopPropagation(); // Prevent type click
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Field type colon
    fieldGroups.append('text')
      .attr('class', 'field-colon')
      .attr('x', d => -d.parentNode.width / 2 + 10 + (d.name.length * 7.2)) // Approximate character width
      .attr('y', d => d.yOffset)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-family', 'Monaco, Menlo, monospace')
      .attr('fill', isDarkTheme ? '#888888' : '#666666')
      .text(': ')
      .on('click', function(event, d) {
        event.stopPropagation(); // Prevent type click
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Field types
    fieldGroups.append('text')
      .attr('class', 'field-type')
      .attr('x', d => -d.parentNode.width / 2 + 10 + (d.name.length * 7.2) + 15) // After name and colon
      .attr('y', d => d.yOffset)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-family', 'Monaco, Menlo, monospace')
      .attr('font-weight', '400')
      .attr('fill', d => {
        // Color-code different types
        const baseType = d.type.replace(/[\[\]!]/g, ''); // Remove list/non-null markers
        if (['String', 'Int', 'Float', 'Boolean', 'ID'].includes(baseType)) {
          return isDarkTheme ? '#569cd6' : '#0066cc'; // Blue for scalars
        } else if (d.isList) {
          return isDarkTheme ? '#dcdcaa' : '#795e26'; // Yellow for lists
        } else {
          return isDarkTheme ? '#4ec9b0' : '#267f99'; // Teal for object types
        }
      })
      .text(d => `${d.isList ? '[' : ''}${d.type}${d.isList ? ']' : ''}`)
      .on('click', function(event, d) {
        event.stopPropagation(); // Prevent type click
        if (d.location) {
          vscode.postMessage({
            command: 'navigateToLocation',
            location: d.location
          });
        }
      });
    
    // Update on tick
    simulation.on('tick', () => {
      // Update curved connections from fields to types
      link.attr('d', calculateConnectionPath);
      
      // Update link label positions
      linkLabels
        .attr('x', d => calculateLabelPosition(d).x)
        .attr('y', d => calculateLabelPosition(d).y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Drag functions - don't restart simulation
    function dragstarted(event, d) {
      // Don't restart simulation on drag
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
      d.x = event.x;
      d.y = event.y;
      
      // Update position immediately without simulation
      d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
      
      // Update connected links and labels
      link.attr('d', calculateConnectionPath);
      linkLabels
        .attr('x', l => calculateLabelPosition(l).x)
        .attr('y', l => calculateLabelPosition(l).y);
    }
    
    function dragended(event, d) {
      // Keep the node fixed at its new position
      // Don't restart simulation
    }
    
    // Controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 1.2);
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 1 / 1.2);
    });
    
    document.getElementById('reset').addEventListener('click', () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
      simulation.alpha(1).restart();
    });
    
    document.getElementById('refresh').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh-schema' });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search');
    let searchResults = [];
    let currentSearchIndex = 0;
    
    if (searchInput && !document.getElementById('search-next')) {
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
      
      // Reset highlights
      node.select('rect.type-box')
        .attr('stroke-width', 2)
        .attr('stroke', isDarkTheme ? '#6b6b6b' : '#333333');
      
      if (!searchTerm) {
        searchResults = [];
        if (searchCount) searchCount.style.display = 'none';
        return;
      }
      
      searchResults = nodes.filter(d => {
        if (!d || !d.typeName) return false;
        const typeName = d.typeName.toLowerCase();
        if (typeName.includes(searchTerm)) return true;
        return (d.fields || []).some(field => 
          field && (
            (field.name || '').toLowerCase().includes(searchTerm) || 
            (field.type || '').toLowerCase().includes(searchTerm)
          )
        );
      });
      
      if (searchResults.length > 0 && searchCount) {
        searchCount.textContent = `${searchResults.length} match${searchResults.length === 1 ? '' : 'es'}`;
        searchCount.style.display = 'inline';
        currentSearchIndex = 0;
        highlightSearchResult(0);
      } else if (searchCount) {
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
      
      // Reset all highlights
      node.select('rect.type-box')
        .attr('stroke-width', 2)
        .attr('stroke', isDarkTheme ? '#6b6b6b' : '#333333');
      
      // Highlight current result
      const currentResult = searchResults[index];
      if (currentResult) {
        node.filter(d => d === currentResult)
          .select('rect.type-box')
          .attr('stroke', '#ff5722')
          .attr('stroke-width', 4);
        
        // Center on result
        const transform = d3.zoomTransform(svg.node());
        const x = width / 2 - (currentResult.x || 0) * transform.k;
        const y = height / 2 - (currentResult.y || 0) * transform.k;
        
        svg.transition().call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(transform.k));
      }
      
      const searchCount = document.getElementById('search-count');
      if (searchCount) {
        searchCount.textContent = `${index + 1} of ${searchResults.length}`;
      }
    }
    
    let searchTimeout;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
      });
      
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
    }
    
    // Focus on selected type if provided
    if (focusedType) {
      simulation.on('end', () => {
        const focusedNode = nodes.find(d => d.typeName === focusedType);
        if (focusedNode) {
          node.filter(d => d === focusedNode)
            .select('rect')
            .attr('stroke', '#ff0000')
            .attr('stroke-width', 4);
          
          const x = width / 2 - focusedNode.x;
          const y = height / 2 - focusedNode.y;
          svg.transition().call(zoom.transform, d3.zoomIdentity.translate(x, y));
        }
      });
    }
    
    debugLog("Clean D3 visualization completed successfully");
    
  } catch (error) {
    debugLog(`Error: ${error.message}`);
    displayErrorMessage(`Visualization error: ${error.message}`);
  }
})(); 