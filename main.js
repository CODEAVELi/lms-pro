const winProbabilities = {
  7: {
    // Week 7 matchups sourced from ESPN FPI projections.
    Rams: 0.596, // vs Jaguars
    Jaguars: 0.404,
    Eagles: 0.522, // vs Vikings
    Vikings: 0.478,
    Chiefs: 0.788, // vs Raiders
    Raiders: 0.212,
    Bears: 0.657, // vs Saints
    Saints: 0.343,
    Patriots: 0.661, // vs Titans
    Titans: 0.339,
    Dolphins: 0.517, // vs Browns
    Browns: 0.483,
    Panthers: 0.515, // vs Jets
    Jets: 0.485,
    Chargers: 0.508, // vs Colts
    Colts: 0.492,
    Broncos: 0.652, // vs Giants
    Giants: 0.348,
    Cowboys: 0.501, // vs Commanders
    Commanders: 0.499,
    Packers: 0.642, // vs Cardinals
    Cardinals: 0.358,
    49ers: 0.545, // vs Falcons
    Falcons: 0.455,
    Lions: 0.616, // vs Buccaneers
    Buccaneers: 0.384,
    Seahawks: 0.521, // vs Texans
    Texans: 0.479
  },
  8: {
    // Example Week 8 data for testing; replace with live odds weekly.
    Steelers: 0.61,
    Ravens: 0.39,
    Bills: 0.71,
    Patriots: 0.29,
    Cowboys: 0.57,
    Giants: 0.43,
    Dolphins: 0.54,
    Jets: 0.46
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'lmsPicks';
  const inputs = Array.from(
    document.querySelectorAll('.week-inputs input[type="text"]')
  );
  const recommendButton = document.getElementById('recommend-button');
  const recommendationOutput = document.getElementById('recommendation');
  const totalWeeks = inputs.length || 18;

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

  const getCurrentWeek = (picks) => {
    for (let i = 0; i < totalWeeks; i += 1) {
      if (!picks[i]) {
        return i + 1;
      }
    }
    return null;
  };

  const recommendPick = (picks) => {
    const currentWeek = getCurrentWeek(picks);
    if (!currentWeek) {
      return {
        message:
          'All weeks already have picks. No recommendation available right now.'
      };
    }

    const weekProbabilities = winProbabilities[currentWeek];
    if (!weekProbabilities) {
      return {
        message: `No win probability data for Week ${currentWeek}.`
      };
    }

    const usedTeams = new Set(
      picks
        .filter(Boolean)
        .map((teamName) => teamName.toLowerCase())
    );

    let bestTeam = null;
    let bestProbability = -1;

    Object.entries(weekProbabilities).forEach(([team, probability]) => {
      if (usedTeams.has(team.toLowerCase())) {
        return;
      }
      if (probability > bestProbability) {
        bestTeam = team;
        bestProbability = probability;
      }
    });

    if (!bestTeam) {
      return {
        message:
          'No available team with win probability data. Check your previous picks.'
      };
    }

    return {
      week: currentWeek,
      team: bestTeam,
      probability: bestProbability
    };
  };

  const renderRecommendation = (result) => {
    if (!recommendationOutput) {
      return;
    }

    if (!result || (!result.team && !result.message)) {
      recommendationOutput.textContent =
        'Unable to produce a recommendation right now.';
      return;
    }

    if (result.team) {
      const percentage = (result.probability * 100).toFixed(1);
      recommendationOutput.textContent = `Recommended Pick for Week ${result.week}: ${result.team} (${percentage}% win chance)`;
      return;
    }

    recommendationOutput.textContent = result.message;
  };

  loadPicks();

  inputs.forEach((input) => {
    input.addEventListener('input', savePicks);
  });

  if (recommendButton) {
    recommendButton.addEventListener('click', () => {
      const picks = collectPicks();
      savePicks();
      const recommendation = recommendPick(picks);
      renderRecommendation(recommendation);
    });
  }
});
