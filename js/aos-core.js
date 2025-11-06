// public/js/aos-core.js
const _state = {
  providers: null,
  resolve: null,
  promise: null,
  version: '1.0.0',
};

_state.promise = new Promise(res => { _state.resolve = res; });

export const AOS = {
  VERSION: _state.version,

  // Called by your builders file when it’s ready
  setProviders(providers) {
    if (!providers || typeof providers.buildPrompt !== 'function') {
      throw new Error('AOS.setProviders: invalid providers');
    }
    _state.providers = providers;
    _state.resolve(providers); // unblock anyone awaiting ready()
  },

  // Consumers call this to get providers safely
  async ready(timeoutMs = 5000) {
    if (_state.providers) return _state.providers;
    const timer = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('AOS.ready() timeout')), timeoutMs)
    );
    return Promise.race([_state.promise, timer]);
  }
};

// global (for non-module legacy code if needed)
if (typeof window !== 'undefined') window.AOS_CORE = AOS;
