// @ts-expect-error: Direct import of node_modules react to customize exports
import * as ReactOriginal from "../node_modules/react";
// @ts-expect-error: Direct export of node_modules react to customize exports
export * from "../node_modules/react";
export default ReactOriginal;

const anyReact: any = ReactOriginal;

// Mock React 19's "use" function to satisfy static ESM bundler analysis for React 18
export const use = anyReact.use || (() => {
    throw new Error("React.use is not supported in this React 18 environment.");
});
