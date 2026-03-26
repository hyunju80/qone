import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
    Handle,
    Position,
    NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Globe, MousePointerClick, LayoutTemplate } from 'lucide-react';

interface MapVisualizerProps {
    actionMap: any;
    onNodeSelect?: (url: string) => void;
}

// Custom Node Component for a "Screen/Page"
const ScreenNode = ({ data, selected }: NodeProps) => {
    // Dynamic color based on depth
    const getDepthStyles = (depth: number) => {
        switch (depth) {
            case 0: return { border: 'border-indigo-600', header: 'bg-indigo-600', dot: 'bg-indigo-600' };
            case 1: return { border: 'border-emerald-600', header: 'bg-emerald-600', dot: 'bg-emerald-600' };
            case 2: return { border: 'border-amber-500', header: 'bg-amber-500', dot: 'bg-amber-500' };
            case 3: return { border: 'border-rose-500', header: 'bg-rose-500', dot: 'bg-rose-500' };
            case 4: return { border: 'border-violet-500', header: 'bg-violet-500', dot: 'bg-violet-500' };
            case 5: return { border: 'border-cyan-500', header: 'bg-cyan-500', dot: 'bg-cyan-500' };
            default: return { border: 'border-slate-500', header: 'bg-slate-500', dot: 'bg-slate-500' };
        }
    };

    const styles = getDepthStyles(data.depth || 0);
    const borderColor = selected ? 'border-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02]' : styles.border;
    const headerBg = styles.header;
    const dotColor = styles.dot;

    return (
        <div className={`bg-white dark:bg-[#16191f] border-2 ${borderColor} rounded-xl shadow-lg w-72 overflow-hidden transition-all duration-300`}>
            {selected && (
                <div className="absolute -top-3 -right-3 bg-indigo-600 text-white p-1 rounded-full shadow-lg z-10 border-2 border-white">
                    <MousePointerClick className="w-3 h-3" />
                </div>
            )}
            <Handle type="target" position={Position.Top} className={`w-3 h-3 ${dotColor}`} />
            <div className={`flex items-center gap-2 ${headerBg} text-white px-4 py-2`}>
                {data.depth === 0 ? <Globe className="w-4 h-4" /> : <LayoutTemplate className="w-4 h-4" />}
                <div className="font-black text-xs uppercase tracking-wider truncate flex-1">
                    {data.title || 'Untitled Screen'}
                </div>
                <div className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">
                    Depth {data.depth}
                </div>
            </div>

            <div className="p-3 text-xs bg-gray-50 dark:bg-[#0c0e12] border-b border-gray-200 dark:border-gray-800">
                <div className="text-[9px] text-gray-400 break-all">{data.url}</div>
            </div>

            <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-[#16191f]">
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Interactable Elements ({data.elements?.length || 0})</div>
                <div className="space-y-1.5">
                    {data.elements?.map((el: any) => (
                        <div key={el.id} className="flex flex-col gap-0.5 p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-bold text-[11px] text-gray-700 dark:text-gray-300 truncate">{el.text}</span>
                            </div>
                            <div className="text-[9px] text-blue-500 dark:text-blue-400 font-mono truncate pl-3 opacity-80" title={el.selector}>
                                {el.selector}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className={`w-3 h-3 ${dotColor}`} />
        </div>
    );
};

const nodeTypes = {
    screen: ScreenNode,
};

const MapVisualizer: React.FC<MapVisualizerProps> = ({ actionMap, onNodeSelect }) => {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        if (!actionMap) return { nodes: [], edges: [] };

        const nodes: any[] = [];
        const edges: any[] = [];
        const processedNodeIds = new Set<string>();

        const traverse = (node: any, x: number, y: number, level: number) => {
            if (!node || processedNodeIds.has(node.node_id)) return;
            processedNodeIds.add(node.node_id);

            // Add Node
            nodes.push({
                id: node.node_id,
                type: 'screen',
                position: { x, y },
                data: {
                    title: node.title,
                    url: node.url,
                    depth: level,
                    elements: node.interactable_elements
                }
            });

            // Process Children
            if (node.children && node.children.length > 0) {
                const childSpacing = 350;
                const totalWidth = (node.children.length - 1) * childSpacing;
                const startX = x - totalWidth / 2;

                node.children.forEach((childWrap: any, index: number) => {
                    const child = childWrap.node;
                    const childX = startX + (index * childSpacing);
                    const childY = y + 400;

                    // Add Edge
                    edges.push({
                        id: `e-${node.node_id}-${child.node_id}`,
                        source: node.node_id,
                        target: child.node_id,
                        label: `Click: "${childWrap.trigger_text}"`,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#6366f1', strokeWidth: 2 },
                        labelStyle: { fill: '#6366f1', fontWeight: 700, fontSize: 11 },
                        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            width: 20,
                            height: 20,
                            color: '#6366f1',
                        },
                    });

                    traverse(child, childX, childY, level + 1);
                });
            }
        };

        // Start from root
        traverse(actionMap, 0, 0, 0);

        return { nodes, edges };
    }, [actionMap]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update when map changes
    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
        if (onNodeSelect) {
            onNodeSelect({ id: node.id, ...node.data });
        }
    }, [onNodeSelect]);

    return (
        <div className="w-full h-full bg-gray-50/50 dark:bg-black/20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
            >
                <Background color="#ccc" gap={16} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default MapVisualizer;
