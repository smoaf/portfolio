// Camp settings that are meant to be changed by hand.
//
// Message form ("Leave a message", the figure at the camp). Sending is not connected yet: while
// FORM_ENDPOINT is empty the form explains that messages can't be sent. To connect a form service,
// put its URL here (one line). The form POSTs { name, email, message } and expects a 2xx answer.
export const FORM_ENDPOINT = '';
export const FORM_FORMAT = 'json';          // 'json' (application/json body) or 'form' (multipart FormData)
