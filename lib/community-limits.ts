/** Shared by the forms and the server check, so the two can never disagree about what is long enough. */
export const REVIEW_MIN = 10
export const REVIEW_MAX = 1000

export const COMPLAINT_TITLE_MIN = 5
export const COMPLAINT_TITLE_MAX = 120
export const COMPLAINT_BODY_MIN = 30
export const COMPLAINT_BODY_MAX = 2000

/** KC paid per score prediction once the result is entered; an active boost event raises both. */
export const EXACT_REWARD = 150
export const OUTCOME_REWARD = 40
export const EXACT_POINTS = 3
export const OUTCOME_POINTS = 1
