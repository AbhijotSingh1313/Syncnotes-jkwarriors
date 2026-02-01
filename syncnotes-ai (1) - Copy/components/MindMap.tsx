
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapData } from '../types';

interface MindMapProps {
  data: MindMapData;
}

const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 90, bottom: 30, left: 90 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree<MindMapData>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy(data);
    tree(root);

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "mindmap-link")
      .attr("d", d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x));

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "mindmap-node")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", 6)
      .attr("fill", d => d.children ? "#3b82f6" : "#93c5fd");

    node.append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -10 : 10)
      .style("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .style("font-size", "12px")
      .style("font-weight", "500");

  }, [data]);

  return (
    <div className="bg-white border rounded-xl p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Visual Mind Map</h3>
      <svg ref={svgRef} width="800" height="400"></svg>
    </div>
  );
};

export default MindMap;
