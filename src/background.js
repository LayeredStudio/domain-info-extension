global.browser = require('webextension-polyfill')

const doFetch = (req, init) => {
	return fetch(req, init).then(function (response) {
		var contentType = response.headers.get('Content-Type')

		if (response.ok) {
			return response.json()
		} else {
			if (contentType.includes('application/json')) {
				return response.json().then(function (json) {
					throw json
				})
			} else {
				throw new Error(response.statusText)
			}
		}
	})
}

browser.runtime.onMessage.addListener((req, sender) => {
	if (req.action === 'fetch') {
		return new Promise((resolve, reject) => {
			doFetch(req.url, req.options || {})
				.then(resolve)
				.catch(err => resolve({ error: err.error || err.message }))
		})

		return true
	}
})
