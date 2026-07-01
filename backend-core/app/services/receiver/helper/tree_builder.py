from collections import defaultdict
from collections.abc import Callable, Hashable, Iterable, Mapping

type NodeAccessor[KeyT: Hashable, NodeT] = Callable[[NodeT], KeyT]
type TreeBuilder[KeyT: Hashable, NodeT, TreeT] = Callable[[NodeT, list[TreeT]], TreeT]


def build_closure_tree[KeyT: Hashable, NodeT, TreeT, ClosureRowsT](
    *,
    root_id: KeyT,
    nodes: Mapping[KeyT, NodeT],
    closure_rows: Iterable[ClosureRowsT],
    ancestor_key: Callable[[ClosureRowsT], KeyT],
    descendant_key: Callable[[ClosureRowsT], KeyT],
    depth_key: Callable[[ClosureRowsT], int] | None = None,
    node_id_accessor: NodeAccessor[KeyT, NodeT] | None = None,
    build_tree_node: TreeBuilder[KeyT, NodeT, TreeT],
    include_depth: int | None = 1,
) -> TreeT:
    if node_id_accessor is None:

        def _default_node_id_accessor(node: NodeT) -> KeyT:
            return getattr(node, "id")

        node_id_accessor = _default_node_id_accessor

    children_map: dict[KeyT, list[NodeT]] = defaultdict(list)

    for row in closure_rows:
        depth = depth_key(row) if depth_key else None
        if include_depth is not None and depth != include_depth:
            continue

        ancestor_id = ancestor_key(row)
        descendant_id = descendant_key(row)
        if ancestor_id == descendant_id:
            continue

        descendant = nodes.get(descendant_id)
        if descendant is not None:
            children_map[ancestor_id].append(descendant)

    def recurse(node_id: KeyT) -> TreeT:
        node = nodes[node_id]
        child_trees = [recurse(node_id_accessor(child)) for child in children_map.get(node_id, [])]
        return build_tree_node(node, child_trees)

    if root_id not in nodes:
        raise KeyError(f"Root node {root_id!r} not present in provided nodes mapping.")

    return recurse(root_id)
