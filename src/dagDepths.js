export default function({ nodes, links }, idAccessor, {
  nodeFilter = () => true,
  onLoopError = loopIds => { throw `Invalid DAG structure! Found cycle in node path: ${loopIds.join(' -> ')}.` },
  dagNodeSortingOrder = 'depthFirst'
} = {}) {
  // linked graph
  const graph = {};
  const rootCandidates = {}

  nodes.forEach(node => {
    const nodeId = idAccessor(node)
    graph[nodeId] = {
      data: node,
      out : [],
      depth: -1,
      skip: !nodeFilter(node)
    }
    rootCandidates[nodeId] = graph[nodeId]
  });
  links.forEach(({ source, target }) => {
    const sourceId = getNodeId(source);
    const targetId = getNodeId(target);
    if (!graph.hasOwnProperty(sourceId)) throw `Missing source node with id: ${sourceId}`;
    if (!graph.hasOwnProperty(targetId)) throw `Missing target node with id: ${targetId}`;
    const sourceNode = graph[sourceId];
    const targetNode = graph[targetId];

    sourceNode.out.push(targetNode);
    delete rootCandidates[targetId]

    function getNodeId(node) {
      return typeof node === 'object' ? idAccessor(node) : node;
    }
  });

  const foundLoops = [];
  const rootNodes = Object.values(rootCandidates)
  if (dagNodeSortingOrder == 'depthFirst') {
    traverseDepthFirst(rootNodes);
  } else if(dagNodeSortingOrder == 'breadthFirst') {
    traverseBreadthFirst(rootNodes)
  } else {
    throw `Unsupported dagNodeSortingOrder: ${dagNodeSortingOrder}`
  }

  const nodeDepths = Object.assign({}, ...Object.entries(graph)
    .filter(([, node]) => !node.skip)
    .map(([id, node]) => ({ [id]: node.depth }))
  );

  return nodeDepths;

  function traverseDepthFirst(nodes, nodeStack = [], currentDepth = 0) {
    for (let i=0, l=nodes.length; i<l; i++) {
      const node = nodes[i];

      if (nodeAlreadyVisited(node, nodeStack, foundLoops)) {
        continue;
      }

      if (currentDepth > node.depth) { // Don't unnecessarily revisit chunks of the graph
        node.depth = currentDepth;
        traverseDepthFirst(node.out, [...nodeStack, node], currentDepth + (node.skip ? 0 : 1));
      }
    }
  }

  function traverseBreadthFirst(nodes, nodeStack = [], currentDepth = 0) {
    for (let i=0, l=nodes.length; i<l; i++) {
      const node = nodes[i];

      if (node.depth === -1) {
        node.depth = currentDepth;
      } else if (node.depth > currentDepth) {
        node.depth = currentDepth;
      }

      if (nodeAlreadyVisited(node, nodeStack, foundLoops)) {
        continue;
      }

      traverseBreadthFirst(node.out, [...nodeStack, node], currentDepth + (node.skip ? 0 : 1));
    }
  }

  function nodeAlreadyVisited(node, nodeStack, foundLoops) {
    if (nodeStack.indexOf(node) !== -1) {
      const loop = [...nodeStack.slice(nodeStack.indexOf(node)), node].map(d => idAccessor(d.data));
      if (!foundLoops.some(foundLoop => foundLoop.length === loop.length && foundLoop.every((id, idx) => id === loop[idx]))) {
        foundLoops.push(loop);
        onLoopError(loop);
      }
      return true;
    }
    return false;
  }
}