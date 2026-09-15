import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Zera UI crashed", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-zera-canvas px-4 text-zera-ink">
        <div className="w-full max-w-md rounded-xl border border-zera-line bg-white p-6 text-center shadow-card">
          <p className="text-xs font-bold uppercase text-zera-green">Zera Solutions</p>
          <h1 className="mt-2 text-2xl font-bold">This page could not load</h1>
          <p className="mt-3 text-sm leading-6 text-zera-muted">
            Refresh the page. If it continues, sign in again so Zera can rebuild your workspace session.
          </p>
          <button
            className="mt-5 h-11 rounded-md bg-zera-green px-5 text-sm font-bold text-white transition hover:bg-[#116832]"
            type="button"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}
