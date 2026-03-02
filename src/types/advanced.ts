export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type TournamentId = Brand<string, 'TournamentId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type RegistrationId = Brand<string, 'RegistrationId'>;
export type MatchId = Brand<string, 'MatchId'>;

export type Result<T, E extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; message: string };
