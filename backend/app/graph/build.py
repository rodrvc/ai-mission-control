"""Compiles the life-support StateGraph.

Topology (see the ACU-68 plan, "Aristas + loop + interrupt"):

    START -> user_request -> orchestrator -> specialist -> telemetry_tool
          -> diagnostics -> repair -> safety_reviewer
    safety_reviewer --(pass 1, REJECT)--> repair                    (conditional edge)
    safety_reviewer --(pass 2, PENDING_APPROVAL)--> hitl_gate
    hitl_gate --(approve)--> quality_check -> final_response -> END
              --(reject)--> END (failed)

`hitl_gate` is a dedicated node containing ONLY the interrupt() call
(graph/nodes.py) — LangGraph replays a node's full body from the top on
every resume, so any side-effecting emit placed before interrupt() would
double-fire. Splitting review reasoning (`safety_reviewer`, side effects,
runs once) from the pause itself (`hitl_gate`, no side effects before
interrupt, safe to replay) keeps the SSE stream free of duplicate events on
resume — verified empirically against LangGraph's actual node-replay
behavior.

Compiled with MemorySaver so `thread_id == runId` gives us resumable
checkpoints for the interrupt()/Command(resume=...) HITL flow.
"""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.events.emitter import RunEmitter
from app.graph.nodes import make_nodes
from app.graph.state import LifeSupportState


def _route_after_review(state: LifeSupportState) -> str:
    """Conditional edge out of safety_reviewer: pass 1 REJECT loops back to
    repair; pass 2 PENDING_APPROVAL hands off to the interrupt gate."""
    if state.get("review_verdict") == "REJECT":
        return "repair"
    return "hitl_gate"


def _route_after_gate(state: LifeSupportState) -> str:
    """Conditional edge out of hitl_gate, based on the human's decision."""
    if state.get("approved"):
        return "quality_check"
    return END


def build_life_support_graph(emitter: RunEmitter):
    """Builds and compiles the graph, wired to `emitter` for this one run.

    A fresh graph instance per run (rather than a shared singleton) is what
    lets each node close over its own RunEmitter without any global/shared
    mutable state — keeps concurrent runs fully isolated.
    """
    nodes = make_nodes(emitter)

    graph = StateGraph(LifeSupportState)
    graph.add_node("user_request", nodes["user_request"])
    graph.add_node("orchestrator", nodes["orchestrator"])
    graph.add_node("specialist", nodes["specialist"])
    graph.add_node("telemetry_tool", nodes["telemetry_tool"])
    graph.add_node("diagnostics", nodes["diagnostics"])
    graph.add_node("repair", nodes["repair"])
    graph.add_node("safety_reviewer", nodes["safety_reviewer"])
    graph.add_node("hitl_gate", nodes["hitl_gate"])
    graph.add_node("quality_check", nodes["quality_check"])
    graph.add_node("final_response", nodes["final_response"])

    graph.set_entry_point("user_request")
    graph.add_edge("user_request", "orchestrator")
    graph.add_edge("orchestrator", "specialist")
    graph.add_edge("specialist", "telemetry_tool")
    graph.add_edge("telemetry_tool", "diagnostics")
    graph.add_edge("diagnostics", "repair")
    graph.add_edge("repair", "safety_reviewer")
    graph.add_conditional_edges(
        "safety_reviewer",
        _route_after_review,
        {"repair": "repair", "hitl_gate": "hitl_gate"},
    )
    graph.add_conditional_edges(
        "hitl_gate",
        _route_after_gate,
        {"quality_check": "quality_check", END: END},
    )
    graph.add_edge("quality_check", "final_response")
    graph.add_edge("final_response", END)

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)
