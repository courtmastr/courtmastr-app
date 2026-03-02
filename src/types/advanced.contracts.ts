import type {
  Brand,
  TournamentId,
  CategoryId,
  RegistrationId,
  MatchId,
  Result,
} from '@/types/advanced';

type Assert<T extends true> = T;
type IsStringLike<T> = T extends string ? true : false;

type _brandExists = Assert<IsStringLike<Brand<string, 'X'>>>;
type _tournamentIdIsString = Assert<IsStringLike<TournamentId>>;
type _categoryIdIsString = Assert<IsStringLike<CategoryId>>;
type _registrationIdIsString = Assert<IsStringLike<RegistrationId>>;
type _matchIdIsString = Assert<IsStringLike<MatchId>>;

const okResult: Result<{ id: TournamentId }, 'not_found'> = {
  ok: true,
  data: { id: 't-1' as TournamentId },
};

const errResult: Result<never, 'not_found'> = {
  ok: false,
  error: 'not_found',
  message: 'Tournament missing',
};

void okResult;
void errResult;

// Keep aliases reachable for type-check validation
void (0 as unknown as _brandExists);
void (0 as unknown as _tournamentIdIsString);
void (0 as unknown as _categoryIdIsString);
void (0 as unknown as _registrationIdIsString);
void (0 as unknown as _matchIdIsString);
