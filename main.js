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

const TOTAL_WEEKS = 18;
const HORIZON_WEEKS = 8; // Adjust horizon for performance if needed.

const allTeams = new Set();
const canonicalTeamMap = new Map();

Object.values(winProbabilities).forEach((matchups) => {
  Object.keys(matchups).forEach((team) => {
    allTeams.add(team);
    canonicalTeamMap.set(team.toLowerCase(), team);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'lmsPicks';
  const inputs = Array.from(
    document.querySelectorAll('.week-inputs input[type="text"]')
  );
  const recommendButton = document.getElementById('recommend-button');
  const recommendationOutput = document.getElementById('recommendation');
  const totalWeeks = inputs.length || TOTAL_WEEKS;

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

  const getCanonicalTeam = (name) =>
    canonicalTeamMap.get(name.toLowerCase()) || null;

  const buildAvailableTeams = (picks) => {
    const available = new Set(allTeams);
    picks.forEach((teamName) => {
      if (!teamName) {
        return;
      }
      const canonical = getCanonicalTeam(teamName);
      if (canonical) {
        available.delete(canonical);
      }
    });
    return available;
  };

  const getCurrentWeek = (picks) => {
    for (let i = 0; i < totalWeeks; i += 1) {
      if (!picks[i]) {
        return i + 1;
      }
    }
    return null;
  };

  const serializeState = (week, availableTeams) => {
    if (!availableTeams.size) {
      return `${week}|`;
    }
    const ordered = Array.from(availableTeams).sort();
    return `${week}|${ordered.join(',')}`;
  };

  /**
   * Recursively compute max survival probability from `week` to `endWeek`,
   * assuming `availableTeams` are still unused. Memoization keeps this fast.
   */
  const maxSurvivalProb = (week, availableTeams, endWeek, memo) => {
    if (week > endWeek) {
      return 1;
    }

    const memoKey = serializeState(week, availableTeams);
    if (memo.has(memoKey)) {
      return memo.get(memoKey);
    }

    const weekProbabilities = winProbabilities[week];
    if (!weekProbabilities) {
      // No data for this week; move to the next.
      const skipped = maxSurvivalProb(
        week + 1,
        availableTeams,
        endWeek,
        memo
      );
      memo.set(memoKey, skipped);
      return skipped;
    }

    let best = 0;
    let hasCandidate = false;

    Object.entries(weekProbabilities).forEach(([team, probability]) => {
      if (!availableTeams.has(team) || typeof probability !== 'number') {
        return;
      }
      if (probability <= 0) {
        return;
      }
      hasCandidate = true;

      const nextAvailable = new Set(availableTeams);
      nextAvailable.delete(team);

      const futureProb = maxSurvivalProb(
        week + 1,
        nextAvailable,
        endWeek,
        memo
      );
      const survival = probability * futureProb;
      if (survival > best) {
        best = survival;
      }
    });

    const result = hasCandidate ? best : 0;
    memo.set(memoKey, result);
    return result;
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

    const availableTeams = buildAvailableTeams(picks);
    const memo = new Map();
    const endWeek = Math.min(
      TOTAL_WEEKS,
      currentWeek + HORIZON_WEEKS - 1
    );

    let bestTeam = null;
    let bestProbability = -1;

    Object.entries(weekProbabilities).forEach(([team, probability]) => {
      if (!availableTeams.has(team) || typeof probability !== 'number') {
        return;
      }
      if (probability <= 0) {
        return;
      }

      const nextAvailable = new Set(availableTeams);
      nextAvailable.delete(team);

      const futureProb = maxSurvivalProb(
        currentWeek + 1,
        nextAvailable,
        endWeek,
        memo
      );
      const survival = probability * futureProb;

      if (survival > bestProbability) {
        bestProbability = survival;
        bestTeam = team;
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
