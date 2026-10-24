export const queryOptions = {
  groupId: { short: '-g', long: '--group-id <groupId>', description: 'Log group ID', required: true },
  streamId: { short: '-s', long: '--stream-id <streamId>', description: 'Log stream ID', required: true },
  startTime: { short: '--start-time <startTime>', long: '--start-time <startTime>', description: 'Start time (ISO 8601)', required: true },
  endTime: { short: '--end-time <endTime>', long: '--end-time <endTime>', description: 'End time (ISO 8601)', required: true },
  keyword: { short: '-k', long: '--keyword <keyword>', description: 'Search keyword', required: false },
  limit: { short: '-l', long: '--limit <limit>', description: 'Limit number of results', required: false },
  offset: { short: '-o', long: '--offset <offset>', description: 'Offset for pagination', required: false },
  reverse: { short: '-r', long: '--reverse', description: 'Reverse order', required: false },
  format: { short: '-f', long: '--format <format>', description: 'Output format: json, table, pretty', required: false },
  noPaginate: { short: '', long: '--no-paginate', description: 'Disable pagination', required: false },
};
