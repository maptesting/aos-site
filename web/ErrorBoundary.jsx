import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, msg: error?.message || "Something went wrong" };
  }
  componentDidCatch(error, info) {
    console.error("[UI Error]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl bg-red-600/10 border border-red-600/30">
          <h2 className="font-semibold">Oops — UI error</h2>
          <p className="text-sm opacity-80">{this.state.msg}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
