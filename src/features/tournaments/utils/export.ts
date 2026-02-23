import type { Match } from '@/types';

function formatCsvField(field: any): string {
    if (field === null || field === undefined) {
        return '""';
    }
    const stringField = String(field);
    // Escaping quotes by doubling them, and wrapping entire field in quotes
    return `"${stringField.replace(/"/g, '""')}"`;
}

export function exportTournamentMatchesToCSV(
    tournamentName: string,
    matches: Match[],
    getCategoryName: (id: string) => string,
    getParticipantName: (participantId?: string, matchStatus?: string, categoryId?: string) => string,
    formatDate: (date: Date | string | undefined) => string
) {
    const headers = [
        'Match ID',
        'Category',
        'Round',
        'Match Number',
        'Participant 1',
        'Participant 2',
        'Status',
        'Court',
        'Score',
        'Winner',
        'Planned Start',
    ];

    const rows = matches.map(m => {
        // Resolve names using the composable function passed in
        const p1 = getParticipantName(m.participant1Id, m.status, m.categoryId);
        const p2 = getParticipantName(m.participant2Id, m.status, m.categoryId);
        const winner = m.winnerId ? getParticipantName(m.winnerId, 'completed', m.categoryId) : '';

        let timeStr = '';
        const timeVal = m.plannedStartAt || m.scheduledTime;
        if (timeVal) {
            // Ensure date object parsing if string
            const dateObj = typeof timeVal === 'string' ? new Date(timeVal) : timeVal;
            timeStr = formatDate(dateObj);
        }

        return [
            m.id,
            getCategoryName(m.categoryId),
            m.round?.toString() || '',
            m.matchNumber?.toString() || '',
            p1,
            p2,
            m.status,
            m.courtName || m.courtId || '',
            m.score || '',
            winner,
            timeStr
        ].map(formatCsvField).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `${tournamentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_matches_export.csv`;

    // Trigger DOM download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
