// Jest only: Gesture Handler 3 binds to the native UI worklet runtime, which Jest does not have.
module.exports = { installUIRuntimeBindings: () => {} };
