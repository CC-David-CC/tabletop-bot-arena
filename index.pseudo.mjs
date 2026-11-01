// HIGH-LEVEL PSEUDOCODE ONLY — not an installable module.
// Tabletop Bot Arena | Three.js + Rapier
// Helper names below are local design roles, NOT host APIs or a new framework.
// Implement as index.mjs only after reading AGENTS.md and the engine guide.

export function mount(host) {
  const body = host.ui.make("div", "window-content");
  body.dataset.game = "tabletop-bot-arena";
  const signalOwner = new AbortController();
  let disposed = false;
  let game = null;
  let released = false;

  // Local helpers create scoped markup; only ui.make is an assumed host API.
  createLocalShell(body, { title: "Tabletop Bot Arena", loading: true });
  // Host file/focus APIs must be discovered, not guessed by this pseudocode.
  bindReviewedHostServicesOrExplicitBrowserFileUI(host, body, signalOwner.signal);

  queueMicrotask(() => { void initializeThisWindow(); });

  async function initializeThisWindow() {
    try {
      const modules = await loadThisGamesPinnedLocalDependencies();
      if (disposed) return;
      // Allocate but do not start loops/audio before the ownership check.
      const created = await createThisGamesEngineModelAndRive({
        modules, container: body, signal: signalOwner.signal,
        gameId: "tabletop-bot-arena", startAutomatically: false
      });
      if (disposed) { releaseLateAllocation(created); return; }
      game = created;
      installGameSpecificActionsAndResize(body, game, signalOwner.signal);
      // See gameplay.pseudo.txt, CONTROLS.md and RIVE.md in this directory.
      installReviewedDocumentActions(game); // transactional load; explicit save kind
      installFocusVisibilityAndErrorHandling(game);
      prepareOwnXRFlow(game, enterXRFromClick, exitXRFromButton);
      showTitleAndPlayablePreview(game);
      startExactlyOnePresentationLoopWhenSized(game);
    } catch (error) {
      // Initializer releases its partial allocations before rejecting. Also release
      // an adopted game if setup failed after creation; release helpers are null-safe.
      stopAcceptingInputAndCancelHeldActions(game);
      stopSimulationPresentationAndOwnedAudio(game);
      finalizeReleaseOnce();
      if (!disposed) showActionableInitializationError(body, error);
    }
  }

  // XR hooks are implemented INSIDE THIS APP using its selected engine path.
  // Prebuild the helper/materials and check capabilities before enabling entry.
  function enterXRFromClick(mode) {
    if (disposed || !game || !canEnterFromCurrentPhase(game)) return;
    pauseAtCommittedTickAndClearInput(game);
    rememberDesktopPresentation(game); // not a copy of the gameplay state
    // This symbolic helper must request immediately within the click gesture.
    // Install end observers before entry; no awaited fetch before requestSession.
    requestThroughThisEnginesPreparedXRPath(game, mode, {
      onAcquired(session) {
        if (disposed) { endLateSessionThen(session, finalizeReleaseOnce); return; }
        ownSessionForThisWindow(game, session);
        showPlacementOrResumeInsideXR(game); // SAME model/world
      },
      onEnded(session) {
        if (!isThisWindowsCurrentSession(game, session)) return;
        releaseTransientXRHandles(game, session);
        if (disposed) { finalizeReleaseOnce(); return; }
        restoreDesktopPresentationWithoutReloadingGame(game);
        showPausedWindowWithResume(game);
      },
      onFailure(error) {
        if (!disposed) showSamePausedGameAndError(game, error);
      }
    });
  }
  function exitXRFromButton() {
    // Request end only for this app's owned session; finalize on observed end.
    endOnlyThisWindowsSession(game);
  }

  function finalizeReleaseOnce() {
    if (released) return;
    released = true;
    releaseOwnedRiveTexturesAudioWorkersObserversAndEngine(game);
    game = null;
  }

  return {
    element: body,
    dispose() {
      if (disposed) return;
      disposed = true;
      signalOwner.abort();
      stopAcceptingInputAndCancelHeldActions(game);
      stopSimulationPresentationAndOwnedAudio(game);

      // Stop gameplay now. Session ending may finish asynchronously.
      // If entry is pending, its late-result cleanup owns ending that session.
      endOwnedOrPendingXRThen(game, finalizeReleaseOnce);
    }
  };
}
