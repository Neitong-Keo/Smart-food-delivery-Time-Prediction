export function WorkspaceSkeleton() {
  return (
    <div className="workspace" role="status" aria-label="Loading">
      <div className="workspace-panel">
        <div className="skeleton" style={{ height: "2.5rem", width: "75%" }} />
        <div className="skeleton" style={{ height: "4.5rem" }} />
        <div className="skeleton" style={{ height: "2.75rem" }} />
        <div className="skeleton" style={{ height: "2.75rem" }} />
      </div>
      <div className="workspace-map skeleton" />
    </div>
  );
}
