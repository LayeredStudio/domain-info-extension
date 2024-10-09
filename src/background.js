chrome.runtime.onInstalled.addListener((details) => {
	console.log('onInstalled...', details);

	if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {     
		//chrome.runtime.openOptionsPage();
	}

	// disable extension action
	chrome.action.disable();

	// enable extension action on valid domains
	chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {

		// rules: tabs with valid domains
		const rules = [{
			conditions: [
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: {schemes: ['http', 'https', 'ftp']},
				})
			],
			actions: [new chrome.declarativeContent.ShowAction()],
		}];

		chrome.declarativeContent.onPageChanged.addRules(rules);
	});
});

//chrome.runtime.setUninstallURL("https://dmns.app/browser-extension/uninstall");
