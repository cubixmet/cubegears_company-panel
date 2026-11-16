import { useState } from 'react';
import { UNSAFE_createBrowserHistory, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { internalRecordPath, publicRecordPath } from '../utils/recordReferences';

function createRecordHistory() {
  const history = UNSAFE_createBrowserHistory({ v5Compat: true });
  const canon = (location) => {
    const visible = publicRecordPath(location);
    if (visible.pathname !== location.pathname || visible.search !== location.search || visible.hash !== location.hash) {
      window.history.replaceState(window.history.state, '', history.createHref(visible));
    }
    return internalRecordPath(visible);
  };
  return {
    get action() { return history.action; },
    get location() { return canon(history.location); },
    listen(callback) {
      return history.listen((change) => callback({ ...change, location: canon(change.location) }));
    },
    createHref: (to) => history.createHref(publicRecordPath(to)),
    createURL: (to) => history.createURL(publicRecordPath(to)),
    encodeLocation: history.encodeLocation,
    push: (to, state) => history.push(publicRecordPath(to), state),
    replace: (to, state) => history.replace(publicRecordPath(to), state),
    go: history.go,
  };
}

export function RecordReferenceRouter({ children }) {
  const [history] = useState(createRecordHistory);
  return <HistoryRouter history={history}>{children}</HistoryRouter>;
}
