document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'lmsPicks';
  const inputs = Array.from(
    document.querySelectorAll('.week-inputs input[type="text"]')
  );
  const recommendButton = document.getElementById('recommend-button');

  if (!inputs.length) {
    // No inputs found; nothing to wire up.
    return;
  }

  const loadPicks = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const picks = JSON.parse(raw);
      inputs.forEach((input, index) => {
        if (Array.isArray(picks)) {
          input.value = picks[index] ?? '';
        } else if (picks && typeof picks === 'object') {
          const weekKey = `week-${index + 1}`;
          input.value = picks[weekKey] ?? '';
        }
      });
    } catch (error) {
      // Corrupt data should be ignored so the user can continue.
      console.warn('Unable to parse saved picks:', error);
      localStorage.removeItem(storageKey);
    }
  };

  const collectPicks = () =>
    inputs.map((input) => input.value.trim());

  const savePicks = () => {
    const picks = collectPicks();
    localStorage.setItem(storageKey, JSON.stringify(picks));
  };

  loadPicks();

  inputs.forEach((input) => {
    input.addEventListener('input', savePicks);
  });

  if (recommendButton) {
    recommendButton.addEventListener('click', () => {
      // Ensure the latest picks are saved before running recommendation logic.
      savePicks();
      // Recommendation logic will be added in a later phase.
    });
  }
});
