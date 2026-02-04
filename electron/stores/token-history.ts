import Store from 'electron-store';

export interface HourlyUsage {
  hour: number; // 0-23
  input: number;
  output: number;
}

export interface DailyTokenUsage {
  date: string; // YYYY-MM-DD
  hourlyUsage: HourlyUsage[];
  dailyTotal: {
    input: number;
    output: number;
  };
}

interface TokenHistoryStore {
  history: DailyTokenUsage[];
  maxDaysToKeep: number;
}

const defaults: TokenHistoryStore = {
  history: [],
  maxDaysToKeep: 30,
};

let store: Store<TokenHistoryStore>;

export function initTokenHistoryStore(): void {
  store = new Store<TokenHistoryStore>({
    name: 'token-history',
    defaults,
  });

  // Clean up old entries on init
  cleanupOldEntries();
}

function getStore(): Store<TokenHistoryStore> {
  if (!store) initTokenHistoryStore();
  return store;
}

function cleanupOldEntries(): void {
  const history = getStore().get('history');
  const maxDays = getStore().get('maxDaysToKeep');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const filtered = history.filter((entry) => entry.date >= cutoffStr);
  if (filtered.length !== history.length) {
    getStore().set('history', filtered);
  }
}

export function recordHourlyUsage(input: number, output: number): void {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  const history = getStore().get('history');
  let todayEntry = history.find((entry) => entry.date === today);

  if (!todayEntry) {
    todayEntry = {
      date: today,
      hourlyUsage: [],
      dailyTotal: { input: 0, output: 0 },
    };
    history.push(todayEntry);
  }

  // Find or create hourly entry
  let hourlyEntry = todayEntry.hourlyUsage.find((h) => h.hour === currentHour);
  if (!hourlyEntry) {
    hourlyEntry = { hour: currentHour, input: 0, output: 0 };
    todayEntry.hourlyUsage.push(hourlyEntry);
  }

  // Update hourly totals
  hourlyEntry.input += input;
  hourlyEntry.output += output;

  // Update daily totals
  todayEntry.dailyTotal.input += input;
  todayEntry.dailyTotal.output += output;

  getStore().set('history', history);
}

export function getTokenHistory(days: number = 7): DailyTokenUsage[] {
  const history = getStore().get('history');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  return history
    .filter((entry) => entry.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTotalUsageForPeriod(days: number): { input: number; output: number } {
  const history = getTokenHistory(days);
  return history.reduce(
    (acc, entry) => ({
      input: acc.input + entry.dailyTotal.input,
      output: acc.output + entry.dailyTotal.output,
    }),
    { input: 0, output: 0 }
  );
}

export function getAverageDailyUsage(days: number = 7): { input: number; output: number } {
  const history = getTokenHistory(days);
  if (history.length === 0) return { input: 0, output: 0 };

  const total = getTotalUsageForPeriod(days);
  return {
    input: Math.round(total.input / history.length),
    output: Math.round(total.output / history.length),
  };
}

export function setMaxDaysToKeep(days: number): void {
  getStore().set('maxDaysToKeep', days);
  cleanupOldEntries();
}

export function clearTokenHistory(): void {
  getStore().set('history', []);
}
