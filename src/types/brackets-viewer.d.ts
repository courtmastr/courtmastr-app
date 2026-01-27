// Type declaration for brackets-viewer (no official types available)
declare module 'brackets-viewer/dist/brackets-viewer.min.js' {
    export function render(
        data: {
            stages: any[];
            matches: any[];
            participants: any[];
            matchGames?: any[];
        },
        options?: {
            selector?: HTMLElement | string;
            clear?: boolean;
            participantOriginPlacement?: 'before' | 'after';
            matchClickCallback?: (match: any) => void;
            customRoundName?: (info: any, metadata: any) => string;
        }
    ): void;
}
