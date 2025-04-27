<script>
import { getAllDnsRecordsStream, parseDnsRecord, detectWildcardRecords } from '@layered/dns-records'
import { identifyServicesFromDnsRecord, identifyServicesFromNameServer } from '@layered/domain-utils'
import { formatDistanceToNow } from 'date-fns'
import ipRegex from 'ip-regex'
import { uniq } from 'lodash-es'
import md5 from 'md5'
import { parse } from 'tldts'

import DateTime from './components/DateTime.vue'
import { countryCodeToFlag } from './utils/geo.ts'

const apiRequest = path => {
	const url = new URL(path, 'https://domains-api.com')
	url.searchParams.set('key', process.env.VUE_DOMAINS_API_KEY)

	return fetch(url, {
		method: 'GET',
		headers: {},
	})
}

export default {
	components: {
		DateTime,
	},
	data() {
		return {
			id: '',
			opens: 0,
			promos: [],
			isAllowedIncognitoAccess: undefined,
			tabType: 'domain',
			tabUrl: null,
			tabFavicon: null,
			domain: null,
			subdomain: null,
			view: 'overview',
			states: {
				domain: 'loading',
				whois: 'loading',
				history: 'loading',
				dns: 'loading',
			},

			domainInfo: {
				domain: '',
				keyword: '',
				tld: '',
				availability: 'registered',
				status: [],
				nameservers: [],
				dates: {
					created: null,
					updated: null,
					expiry: null,
				},
			},
			contactTypes: ['registrant'],
			contactType: 'registrant',

			whois: null,
			whoisServers: [],
			whoisView: 'table',
			whoisData: 'both',
			whoisDiff: true,
			whoisTimeStyle: 'datetime',
			whoisGroup: [
				{
					name: 'General info',
					fields: [
						'Domain Name',
						'IDN',
						'Domain Status',
						'Name Server',
						'Created Date',
						'Updated Date',
						'Expiry Date',
						'ROID',
						'Registry Domain ID',
						'Domain ID',
						'DNSSEC',
					],
				},
				{
					name: 'Registrar',
					fields: [
						'Registrar',
						'Sponsoring Registrar',
						'Record maintained by',
						'Registrar URL',
						'Registrar WHOIS Server',
						'Registry WHOIS Server',
						'Registrar IANA ID',
						'Registrar Abuse Contact Email',
						'Registrar Abuse Contact Phone',
						'Referral URL',
						'Registrar-Reseller Name',
						'Reseller',
						'Reseller URL',
						'Reseller Name',
						'Reseller Email',
						'admin-contact',
						'Abuse Contact',
						'source',
						'Sponsoring Registrar Organization',
						'Sponsoring Registrar URL',
					],
				},
				{
					name: 'Contact - Registrant',
					fields: [
						'Registry Registrant ID',
						'Registrant ID',
						'Registrant Contact ID',
						'Registrant Name',
						'Registrant Organization',
						'Registrant Street',
						'Registrant City',
						'Registrant State/Province',
						'Registrant Postal Code',
						'Registrant Country',
						'Registrant Email',
						'Registrant Phone',
						'Registrant Phone Ext',
						'Registrant Phone Ext.',
						'Registrant Fax',
						'Registrant Fax Ext',
						'Registrant Fax Ext.',
						'Registrant Application Purpose',
						'Registrant Nexus Category',
					],
				},
				{
					name: 'Contact - Admin',
					fields: [
						'Registry Admin ID',
						'Admin Name',
						'Admin Organization',
						'Admin Organisation',
						'Admin Street',
						'Admin City',
						'Admin State/Province',
						'Admin Postal Code',
						'Admin Country',
						'Admin Phone',
						'Admin Email',
						'Admin Phone Ext',
						'Admin Fax',
						'Admin Fax Ext',
						'Admin Phone Ext.',
						'Admin Fax Ext.',
						'Admin Application Purpose',
						'Admin Nexus Category',
					],
				},
				{
					name: 'Contact - Tech',
					fields: [
						'Registry Tech ID',
						'Tech Contact ID',
						'Tech Name',
						'Tech Contact Name',
						'Tech Organization',
						'Tech Organisation',
						'Tech Street',
						'Tech City',
						'Tech State/Province',
						'Tech Postal Code',
						'Tech Country',
						'Tech Phone',
						'Tech Email',
						'Tech Phone Ext',
						'Tech Fax',
						'Tech Fax Ext',
						'Tech Phone Ext.',
						'Tech Fax Ext.',
						'Tech Application Purpose',
						'Tech Nexus Category',
					],
				},
				{
					name: 'Contact - Billing',
					fields: [
						'Registry Billing ID',
						'Billing Name',
						'Billing Organization',
						'Billing Organisation',
						'Billing Street',
						'Billing City',
						'Billing State/Province',
						'Billing Postal Code',
						'Billing Country',
						'Billing Phone',
						'Billing Email',
						'Billing Phone Ext',
						'Billing Fax',
						'Billing Fax Ext',
						'Billing Phone Ext.',
						'Billing Fax Ext.',
					],
				},
			],

			history: [],

			records: [],
			recordsGrouped: {
				A: {},
				AAAA: {},
				CNAME: {},
				TXT: {},
			},

			services: [],

			showRelated: false,
			related: 'similar-websites',
			relatedSimilarWebsites: [],

			ipInfoLoaded: new Set(),
			ipInfo: {},
		}
	},
	computed: {
		whoisGroupFields() {
			return this.whoisGroup.map(g => g.fields).flat()
		},
		nameServers() {
			if (this.domainInfo.nameservers.length) {
				return this.domainInfo.nameservers
			} else {
				return this.records.filter(r => r.type === 'NS').map(r => r.value)
			}
		},
		expiryBgClass() {
			if (this.domainInfo.dates.expiry) {
				const expiryDays = Math.ceil((new Date(this.domainInfo.dates.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

				if (expiryDays < 11) {
					return 'bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800'
				} else if (expiryDays < 21) {
					return 'bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900'
				} else if (expiryDays < 31) {
					return 'bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900'
				}
			}

			return 'bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 dark:hover:bg-cyan-900'
		},
	},

	created() {
		this.checkTab()
		this.loadSettings()
		this.id = chrome.runtime.id
	},

	methods: {
		countryCodeToFlag,
		formatDistanceToNow,
		uniq,

		isIp(ip) {
			return ipRegex({ exact: true }).test(ip)
		},
		urlPart(url, key) {
			const urlObj = new URL(url)

			return urlObj[key]
		},

		async checkTab() {
			const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
			// tab.icognito

			console.log('Domain Info', 'tab url', tab.url)

			this.tabFavicon = tab.favIconUrl
			this.tabUrl = new URL(tab.url)

			const parsed = parse(this.tabUrl.hostname, {
				validateHostname: false,
			})

			this.domain = parsed.domain || parsed.hostname
			this.subdomain = parsed.subdomain || null
			this.domainInfo.domain = this.domain
			this.domainInfo.keyword = parsed.domainWithoutSuffix
			this.domainInfo.tld = parsed.publicSuffix

			if (parsed.isIp) {
				this.tabType = 'ip'
			} else if (parsed.isIcann) {
				this.loadDomainInfo()
				this.loadHistory()
				this.loadDnsRecords()
				this.loadRelatedDomains()
			} else {
				this.tabType = 'invalid'
			}
		},

		loadSettings() {
			chrome.storage.sync.get(['opens', 'lastview', 'datetimestyle', 'promos']).then(kv => {
				this.opens = (kv.opens || 0) + 1
				chrome.storage.sync.set({ opens: this.opens })

				//todo check if option is set to: Last tab
				const useLastView = true
				if (useLastView && kv.lastview) {
					this.view = kv.lastview
				}

				if (kv.datetimestyle && kv.datetimestyle !== 'datetime') {
					this.whoisTimeStyle = kv.datetimestyle
				}

				if (kv.promos) {
					this.promos = kv.promos.split(',')
				}
			})

			chrome.extension.isAllowedIncognitoAccess().then(access => {
				this.isAllowedIncognitoAccess = access
			})
		},
		setView(view) {
			this.view = view

			if (view === 'whois' && this.states.whois === 'idle') {
				this.loadWhois()
			}

			chrome.storage.sync.set({ lastview: view === 'whois' ? 'overview' : view })
		},
		hidePromo(promo) {
			this.promos.push(promo)
			chrome.storage.sync.set({ promos: this.promos.join(',') })
		},

		loadDomainInfo() {
			apiRequest(`domains/${this.domain}/info`)
				.then(response => {
					if (response.ok) {
						return response.json()
					} else {
						throw new Error(response.statusText)
					}
				})
				.then(data => {
					// set whois data
					if (data.source === 'whois' && data.whois) {
						this.whoisServers.push(...Object.keys(data.whois))
						this.whois = data.whois
						this.states.whois = 'loaded'
						delete data.whois
					} else {
						this.states.whois = 'idle'
					}

					data.nameservers.forEach(nameServer => {
						const services = identifyServicesFromNameServer(nameServer)
						services.forEach(service => {
							if (!this.services.find(s => s.id === service.id)) {
								this.services.push(service)
							}
						})
					})

					// get contact types with data
					for (const contactType in data.contacts) {
						if (!this.contactTypes.includes(contactType) && data.contacts[contactType] !== null) {
							this.contactTypes.push(contactType)
						}
					}

					// set domain info data
					this.domainInfo = data
					this.states.domain = 'loaded'
				})
				.catch(error => {
					this.domainInfo.availability = 'error'
					this.states.whois = 'error'
					this.whois = error.message
					console.error(error)
				})
		},
		loadWhois() {
			this.states.whois = 'loading'

			apiRequest(`domains/${this.domain}/whois?follow=2`)
				.then(response => {
					if (response.ok) {
						return response.json()
					} else {
						throw new Error(response.statusText)
					}
				})
				.then(data => {
					this.whoisServers.push(...Object.keys(data))
					this.whois = data
					this.states.whois = 'loaded'
				})
				.catch(error => {
					this.whois = error.message
					console.warn('WHOIS error', error)
					this.states.whois = 'error'
				})
		},
		whoisDataDifferent(field) {
			if (this.whoisData !== 'both' || this.whoisServers.length < 2 || !this.whoisDiff) {
				return false
			}

			if (typeof this.whois[this.whoisServers[0]][field] !== typeof this.whois[this.whoisServers[1]][field]) {
				return true
			} else if (typeof this.whois[this.whoisServers[0]][field] === 'string') {
				return this.whois[this.whoisServers[0]][field].toLowerCase() != this.whois[this.whoisServers[1]][field].toLowerCase()
			} else if (Array.isArray(typeof this.whois[this.whoisServers[0]][field])) {
				return this.whois[this.whoisServers[0]][field].length != this.whois[this.whoisServers[1]][field].length
			} else {
				return false
			}
		},
		switchWhoisTimeStyle() {
			this.whoisTimeStyle = this.whoisTimeStyle === 'datetime' ? 'relative' : 'datetime'
			chrome.storage.sync.set({ datetimestyle: this.whoisTimeStyle })
		},

		loadHistory() {
			apiRequest(`domains/${this.domain}/history`)
				.then(response => response.json())
				.then(data => {
					this.history.push(...data)
					this.states.history = 'loaded'
				})
				.catch(error => {
					this.states.history = 'error'
					this.history = error.message
					console.error(error)
				})
		},
		loadRelatedDomains() {
			// similar websites
			apiRequest(`domains/${this.domain}/similar-websites`)
				.then(response => response.json())
				.then(data => {
					this.relatedSimilarWebsites.push(...data)
				})
				.catch(error => {
					this.relatedSimilarWebsites = error.message
					console.error('similar websites', error)
				})
		},

		loadDnsRecords() {
			const options = {
				resolver: 'cloudflare-dns',
			}

			if (this.subdomain) {
				options.subdomains = [this.subdomain]
			}

			const recordsReadableStream = getAllDnsRecordsStream(this.domain, options)
			const reader = recordsReadableStream.getReader()

			const read = () => {
				reader
					.read()
					.then(({ done, value }) => {
						if (done) {
							this.states.dns = 'loaded'
							const wildcardsDetected = detectWildcardRecords(this.domain, this.records)

							if (this.records.length !== wildcardsDetected.length) {
								this.records = wildcardsDetected

								this.recordsGrouped.A = {}
								this.recordsGrouped.AAAA = {}
								this.recordsGrouped.CNAME = {}
								this.recordsGrouped.TXT = {}

								this.records.forEach(record => {
									if (['A', 'AAAA', 'CNAME', 'TXT'].includes(record.type)) {
										this.dnsRecordsGroupsAdd(record)
									}
								})
							}
						} else {
							const record = parseDnsRecord(value)
							this.records.push(record)

							if (['A', 'AAAA', 'CNAME', 'TXT'].includes(record.type)) {
								this.dnsRecordsGroupsAdd(record)
							}

							const services = identifyServicesFromDnsRecord(record)
							services.forEach(service => {
								if (!this.services.find(s => s.id === service.id)) {
									this.services.push(service)
								}
							})

							// load IP info
							if (['A', 'AAAA'].includes(record.type)) {
								this.loadIpInfo(record.data)
							}

							read()
						}
					})
					.catch(error => {
						console.error('dns err', error)
					})
			}

			read()
		},
		dnsRecordsGroupsAdd(record) {
			const hash = `${record.type}-${record.name}`

			this.recordsGrouped[record.type][hash] ||= {
				name: record.name,
				ttl: record.ttl,
				type: record.type,
				data: [],
			}

			this.recordsGrouped[record.type][hash].data.push(record.data)
		},

		getPicture(email) {
			email = String(email).trim().toLowerCase()
			const logoClearbit = `https://logo.clearbit.com/${this.domain}?size=100`

			return this.isEmail(email) ? `https://www.gravatar.com/avatar/${md5(email)}?s=100&d=${logoClearbit}` : logoClearbit
		},
		isEmail(email) {
			email = String(email).trim().toLowerCase()
			return /\S+@\S+\.\S+/.test(email)
		},
		mapUrlForContact(contact) {
			const codeToCountry = {
				AE: 'United Arab Emirates',
				AT: 'Austria',
				CA: 'Canada',
				CZ: 'Czech Republic',
				DE: 'Germany',
				EE: 'Estonia',
				FR: 'France',
				GB: 'United Kingdom',
				IT: 'Italy',
				NL: 'Netherlands',
				NO: 'Norway',
				RO: 'Romania',
				SE: 'Sweden',
				SK: 'Slowakia',
			}

			const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap?key=AIzaSyCsteGqYhVM141VSrVKoNpA17G51g-HF8o')
			mapUrl.searchParams.set('size', '270x177')

			let zoom = [contact.city, contact.state, contact.country].filter(Boolean).length * 3

			if (contact.street || contact.postalCode) {
				const markerLocation = [contact.street, contact.city, contact.state, contact.postalCode, contact.country].filter(Boolean).join(', ')
				mapUrl.searchParams.set('markers', `color:orange|label:${(contact.organization || contact.organization || 'R').slice(0, 1)}|${markerLocation}`)
				zoom += 3
			} else {
				mapUrl.searchParams.set('center', [contact.city, contact.state, codeToCountry[contact.country] || contact.country].filter(Boolean).join(', '))
			}

			mapUrl.searchParams.set('zoom', zoom)

			return mapUrl.toString()
		},
		loadIpInfo(ip) {
			if (!this.ipInfoLoaded.has(ip)) {
				this.ipInfoLoaded.add(ip)
				this.ipInfo[ip] = null

				fetch(`https://web-api.com/ip-info-country/${ip}?key=${import.meta.env.VITE_WEB_API_KEY}`)
					.then(response => {
						if (response.ok) {
							return response.json()
						} else {
							throw new Error(`${response.status} ${response.statusText}`)
						}
					})
					.then(data => {
						this.ipInfo[ip] = data
					})
					.catch(error => {
						console.warn('ip-info error', error.message)
					})
			}
		},

		copyText(event, text) {
			navigator.clipboard.writeText(text)

			const target = event.target
			const originalText = target.textContent
			target.textContent = 'Copied!'

			setTimeout(() => {
				target.textContent = originalText
			}, 1500)
		},
	},
}
</script>

<template>
	<div class="p-3 pb-5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
		<h1 class="text-3xl font-medium dark:text-white">
			<a v-if="tabType === 'domain'" :href="`https://dmns.app/${domain}?ref=browser-extension`" class="text-dark" target="_blank">
				<span class="text-neutral-500">{{ tabUrl?.hostname.replace(domain, '') }}</span
				>{{ domain }}
			</a>
			<span v-else>{{ domain }}</span>
		</h1>

		<template v-if="tabType === 'domain'">
			<div v-if="opens > 50 && opens < 200 && !promos.includes('review')" class="bg-amber-50 rounded-md border border-amber-100 gap-3 p-2 ml-5 flex items-center">
				<p>
					<strong class="text-slate-800">🤩</strong> Is this extension helpful?
					<a href="https://chrome.google.com/webstore/detail/domain-info/afbepfhknfficaflckmgflbmklcleidl/reviews" target="_blank" class="underline text-blue-800"
						>Give it a rating now</a
					>
				</p>
				<span class="inline-block px-2 leading-6 rounded-full bg-slate-200 hover:bg-slate-300 text-center cursor-pointer" @click="hidePromo('review')">X</span>
			</div>
			<div
				v-else-if="opens > 200 && opens < 250 && !isAllowedIncognitoAccess && !promos.includes('icognito')"
				class="bg-amber-50 rounded-md border border-amber-100 gap-3 p-2 ml-5 flex items-center"
			>
				<p>
					<strong class="text-slate-800">Pro tip:</strong> You can get domain info in Icognito mode too, if you
					<a :href="`chrome://extensions/?id=${id}`" target="_blank" class="underline text-blue-800">allow access from Extension settings</a>
				</p>
				<span class="inline-block px-2 leading-6 rounded-full bg-slate-200 hover:bg-slate-300 text-center cursor-pointer" @click="hidePromo('icognito')">X</span>
			</div>
			<a
				v-else
				:href="`https://dmns.app/${domain}?action=monitor&ref=browser-extension`"
				target="_blank"
				class="block rounded-full py-1 px-3 bg-purple-700 hover:bg-purple-600 text-white dark:bg-indigo-800 hover:dark:bg-indigo-700 dark:text-gray-200"
				>Monitor for changes</a
			>
		</template>
	</div>

	<template v-if="tabType === 'domain'">
		<div class="flex text-center">
			<div
				class="flex-1 py-3 cursor-pointer dark:text-white"
				:class="view === 'overview' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'"
				@click="setView('overview')"
			>
				Overview
			</div>
			<div
				class="flex-1 py-3 cursor-pointer dark:text-white"
				:class="view === 'history' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'"
				@click="setView('history')"
			>
				History
				<span
					v-if="Array.isArray(history)"
					class="bg-indigo-100 dark:bg-indigo-900 p-1 ml-1 rounded"
					:class="history.length ? 'text-indigo-900 dark:text-indigo-100' : 'text-neutral-700 dark:text-neutral-300'"
					>{{ history.length }}</span
				>
			</div>
			<div
				class="flex-1 py-3 cursor-pointer dark:text-white"
				:class="view === 'whois' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'"
				@click="setView('whois')"
			>
				WHOIS
			</div>
			<div
				class="flex-1 py-3 cursor-pointer dark:text-white"
				:class="view === 'dns' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'"
				@click="setView('dns')"
			>
				DNS Records
				<span
					v-if="Array.isArray(records)"
					class="bg-indigo-100 dark:bg-indigo-900 p-1 ml-1 rounded"
					:class="records.length ? 'text-indigo-900 dark:text-indigo-100' : 'text-neutral-700 dark:text-neutral-300'"
					>{{ records.length }}</span
				>
			</div>
			<!-- <div class="flex-1 py-3 cursor-pointer dark:text-white" :class="view === 'ns' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'" @click="setView('ns')">
				Name Servers
			</div> -->
			<!-- <div class="flex-1 py-3 cursor-pointer dark:text-white" :class="view === 'emails' ? 'font-bold' : 'bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 font-medium'" @click="setView('emails')">
				Emails
			</div> -->
		</div>

		<template v-if="view === 'overview'">
			<template v-if="domainInfo.availability === 'registered'">
				<div class="p-3 pb-1">
					<h3 class="mb-1 text-lg dark:text-gray-200">Important dates</h3>

					<div class="grid grid-cols-3 gap-3 mb-4">
						<div class="bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 dark:text-gray-200 p-3 text-center rounded-md">
							<p class="uppercase text-gray-600 dark:text-gray-400">Created</p>

							<template v-if="states.domain === 'loading'">
								<h4 class="text-xl my-1">..</h4>
								<p class="text-gray-600 dark:text-gray-400">loading</p>
							</template>
							<template v-else-if="domainInfo.dates.created">
								<h4 class="text-xl my-1">{{ new Date(domainInfo.dates.created).toLocaleDateString('default', { dateStyle: 'medium' }) }}</h4>
								<p class="text-gray-600 dark:text-gray-400">{{ formatDistanceToNow(new Date(domainInfo.dates.created), { addSuffix: true }) }}</p>
							</template>
							<p v-else class="text-gray-500 dark:text-gray-600 my-1">unknown</p>
						</div>

						<div
							class="bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 dark:text-gray-200 p-3 text-center rounded-md cursor-pointer"
							@click="setView('history')"
						>
							<p class="uppercase text-gray-600 dark:text-gray-400">Updated</p>

							<template v-if="states.domain === 'loading'">
								<h4 class="text-xl my-1">..</h4>
								<p class="text-gray-600 dark:text-gray-400">loading</p>
							</template>
							<template v-else-if="domainInfo.dates.updated">
								<h4 class="text-xl my-1">{{ new Date(domainInfo.dates.updated).toLocaleDateString('default', { dateStyle: 'medium' }) }}</h4>
								<p class="text-gray-600 dark:text-gray-400">{{ formatDistanceToNow(new Date(domainInfo.dates.updated), { addSuffix: true }) }}</p>
							</template>
							<p v-else class="text-gray-500 dark:text-gray-600 my-1">unknown</p>
						</div>

						<div class="dark:text-gray-200 p-3 text-center rounded-md" :class="expiryBgClass">
							<p class="uppercase text-gray-600 dark:text-gray-400">
								{{ domainInfo.dates.expiry && new Date(domainInfo.dates.expiry) < new Date() ? 'Expired' : 'Expires' }}
							</p>

							<template v-if="states.domain === 'loading'">
								<h4 class="text-xl my-1">..</h4>
								<p class="text-gray-600 dark:text-gray-400">loading</p>
							</template>
							<template v-else-if="domainInfo.dates.expiry">
								<h4 class="text-xl my-1">{{ new Date(domainInfo.dates.expiry).toLocaleDateString('default', { dateStyle: 'medium' }) }}</h4>
								<p class="text-gray-600 dark:text-gray-400">{{ formatDistanceToNow(new Date(domainInfo.dates.expiry), { addSuffix: true }) }}</p>
							</template>
							<p v-else class="text-gray-500 dark:text-gray-600 my-1">unknown</p>
						</div>
					</div>

					<div class="flex items-center gap-3 mb-1">
						<h3 class="mb-1 text-lg dark:text-gray-200">Contacts</h3>
						<div class="text-neutral-600 dark:text-neutral-400">
							<span
								v-for="ctype in contactTypes"
								class="capitalize cursor-pointer mx-1"
								:class="{ 'font-semibold text-slate-900 dark:text-slate-100': ctype === contactType }"
								@click="contactType = ctype"
								>{{ ctype }}</span
							>
						</div>
					</div>

					<div v-if="domainInfo.contacts" class="flex items-center bg-slate-50 dark:bg-slate-800 gap-2 rounded-md mb-4">
						<img
							:src="getPicture(domainInfo.contacts[contactType]?.email || '')"
							:alt="domain"
							@error="$event.target.src = tabFavicon || 'https://files.layered.market/neutral-2.png'"
							class="block m-2 ml-3"
							width="50"
							height="50"
						/>
						<div class="flex-grow py-3 dark:text-gray-200">
							<p v-if="domainInfo.contacts[contactType]?.name || domainInfo.contacts[contactType]?.organization" class="text-lg mb-1">
								{{ uniq([domainInfo.contacts[contactType]?.name, domainInfo.contacts[contactType]?.organization].filter(Boolean)).join(', ') }}
							</p>
							<p v-else class="text-neutral-500 dark:text-neutral-400 mb-1">Unknown</p>

							<p
								v-if="domainInfo.contacts[contactType]?.city || domainInfo.contacts[contactType]?.stateOrProvince || domainInfo.contacts[contactType]?.country"
								class="mt-1"
							>
								📍
								{{
									uniq(
										[
											domainInfo.contacts[contactType].city,
											[domainInfo.contacts[contactType].stateOrProvince, domainInfo.contacts[contactType].postalCode].filter(Boolean).join(' '),
											domainInfo.contacts[contactType].country,
										].filter(Boolean),
									).join(', ')
								}}
							</p>

							<p v-if="domainInfo.contacts[contactType]?.phone" class="mt-1">📞 {{ domainInfo.contacts[contactType].phone }}</p>
							<p v-if="domainInfo.contacts[contactType]?.email" class="mt-1 break-all">💬 {{ domainInfo.contacts[contactType].email }}</p>
							<p v-if="domainInfo.contacts[contactType]?.contactUrl" class="mt-1 break-all">
								💬 <a :href="domainInfo.contacts[contactType].contactUrl" target="_blank">{{ domainInfo.contacts[contactType].contactUrl }}</a>
							</p>
						</div>
						<img
							v-if="domainInfo.contacts[contactType]?.country"
							:src="mapUrlForContact(domainInfo.contacts[contactType])"
							width="180"
							height="118"
							alt="Registrant location"
							class="rounded-r"
						/>
					</div>
					<div v-else class="flex items-center bg-slate-50 dark:bg-slate-800 gap-2 rounded-md mb-4">
						<img
							:src="tabFavicon || 'https://files.layered.market/neutral-2.png'"
							:alt="domain"
							@error="$event.target.src = 'https://files.layered.market/neutral-2.png'"
							class="block m-2 ml-3"
							width="50"
							height="50"
						/>
						<div class="flex-grow py-3">
							<p class="text-neutral-500 dark:text-neutral-400">loading..</p>
						</div>
					</div>

					<h3 class="text-lg dark:text-gray-200" @dblclick="showRelated = !showRelated">Uses:</h3>
				</div>

				<table class="w-full mb-1">
					<tbody>
						<tr class="hover:bg-slate-100 dark:hover:bg-slate-900 border-b border-slate-100 dark:border-slate-900">
							<td class="p-2 pl-3 dark:text-gray-300">Domain registrar</td>
							<td class="p-2 dark:text-gray-200">
								<Popper v-if="domainInfo.registrar" :hover="true" placement="top">
									<a v-if="domainInfo.registrar.url && domainInfo.registrar.url !== 'http://'" :href="domainInfo.registrar.url" target="_blank">
										<img
											:src="`https://logo.clearbit.com/${urlPart(domainInfo.registrar.url, 'hostname')}?size=32`"
											@error="$event.target.style.display = 'none'"
											height="16"
											class="float-left h-4 mr-1 rounded"
											:alt="domainInfo.registrar.name"
										/>
										{{ domainInfo.registrar.name }}
									</a>
									<template v-else>{{ domainInfo.registrar.name }}</template>

									<template #content>
										<template v-for="(value, label) in domainInfo.registrar">
											<p v-if="label !== 'name'" class="mb-1 last:mb-0">
												<span class="uppercase">{{ label }}</span
												>: <strong>{{ value }}</strong>
											</p>
										</template>
									</template>
								</Popper>
								<span v-else>..</span>
							</td>
						</tr>
						<tr class="hover:bg-slate-100 dark:hover:bg-slate-900 border-b border-slate-100 dark:border-slate-900">
							<td class="p-2 pl-3 dark:text-gray-300">Domain Status</td>
							<td class="py-1 px-2 dark:text-gray-200">
								<span
									v-for="status in domainInfo.status"
									class="inline-block bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 rounded px-1 my-1 mr-2"
									>{{ status }}</span
								>
							</td>
						</tr>
						<tr class="hover:bg-slate-100 dark:hover:bg-slate-900 border-b border-slate-100 dark:border-slate-900">
							<td class="p-2 pl-3 dark:text-gray-300">Name Servers</td>
							<td class="py-1 px-2 dark:text-gray-200">
								<span v-for="ns in nameServers" class="inline-block bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded px-1 my-1 mr-2">{{
									ns
								}}</span>
							</td>
						</tr>

						<tr v-for="service in services" class="hover:bg-slate-100 dark:hover:bg-slate-900 border-b border-slate-100 dark:border-slate-900">
							<td class="p-2 pl-3 dark:text-gray-300">{{ service.group }}</td>
							<td class="py-1 px-2 dark:text-gray-200">
								<a :href="service.url" target="_blank" :title="service.url">
									<img :src="service.logo" @error="$event.target.style.display = 'none'" height="16" class="float-left h-4 mr-1 rounded" :alt="service.name" />
									{{ service.name }}
								</a>
							</td>
						</tr>
					</tbody>
				</table>

				<template v-if="showRelated">
					<div class="p-3">
						<div class="flex items-center gap-3 mb-1">
							<h3 class="mb-1 text-lg dark:text-gray-200">Related domains</h3>
							<div class="text-neutral-600 dark:text-neutral-400">
								<span
									class="capitalize cursor-pointer mx-1"
									:class="{ 'font-semibold text-slate-900 dark:text-slate-100': related === 'tlds' }"
									@click="related = 'tlds'"
									>Other TLDs</span
								>
								<span
									class="capitalize cursor-pointer mx-1"
									:class="{ 'font-semibold text-slate-900 dark:text-slate-100': related === 'similar-websites' }"
									@click="related = 'similar-websites'"
									>Similar websites ({{ relatedSimilarWebsites.length }})</span
								>
							</div>
						</div>

						<div v-if="related === 'tlds'">[-]</div>
						<div v-else-if="related === 'similar-websites'">
							<a
								v-for="website in relatedSimilarWebsites"
								:href="`https://dmns.app/${website.domain}`"
								target="_blank"
								class="inline-block px-1 rounded bg-slate-100 text-slate-900 mr-2 mb-2"
							>
								{{ website.domain }}
								<span class="text-slate-600">({{ website.score.toFixed(2) }})</span>
							</a>
						</div>
					</div>
				</template>
			</template>
			<template v-else-if="domainInfo.availability === 'available'">
				<div class="m-9 bg-cyan-50 dark:bg-cyan-950 border border-cyan-100 dark:border-cyan-800 rounded-md px-3 py-4 text-center dark:text-gray-200">
					<p class="text-lg mb-3">Great news! This domain is available</p>

					<p class="mb-2 text-gray-800">Register it with:</p>
					<p>
						<a
							href="https://porkbun.com/checkout/search?ref=andreiigna&q=adamadamadamadam.com"
							target="_blank"
							class="inline-block px-2 py-1 rounded bg-slate-50 border border-slate-200 hover:border-slate-300 mx-1"
							><img class="float-left me-1" src="https://porkbun.com/favicon.ico" alt="Porkbun" width="16" height="16" /> Porkbun</a
						>
						<a
							href="https://www.dynadot.com/domain/search?domain=adamadamadamadam.com"
							target="_blank"
							class="inline-block px-2 py-1 rounded bg-slate-50 border border-slate-200 hover:border-slate-300 mx-1"
							><img class="float-left me-1" src="https://www.dynadot.com/favicon.ico" alt="Dynadot" width="16" height="16" /> Dynadot</a
						>
						<a
							href="https://www.namecheap.com/domains/registration/results/?domain=adamadamadamadam.com"
							target="_blank"
							class="inline-block px-2 py-1 rounded bg-slate-50 border border-slate-200 hover:border-slate-300 mx-1"
							><img class="float-left me-1" src="https://www.namecheap.com/favicon.ico" alt="Namecheap" width="16" height="16" /> Namecheap</a
						>
					</p>
				</div>
			</template>
			<template v-else-if="domainInfo.availability === 'unknown'">
				<div class="m-6 bg-amber-50 border border-amber-100 rounded-md p-3 flex gap-x-4 items-center">
					<img src="https://dmns.app/images/plan-pro.png" class="flex-none" width="100" height="100" />

					<div class="flex-grow">
						<p class="text-lg mb-2">Oops, couldn't get info on this domain</p>
						<p>We really tried, but couldn't do it..</p>
					</div>
				</div>
			</template>
			<template v-else-if="domainInfo.availability === 'reserved'">
				<div class="m-6 bg-purple-50 border border-purple-100 rounded-md p-3 flex gap-x-4 items-center">
					<div class="flex-grow text-center">
						<p class="text-lg mb-2">Reserved domain</p>
						<p>
							This domain can't be registered. <a href="https://en.wikipedia.org/wiki/Special-use_domain_name" target="_blank" class="underline">Learn more here</a>
						</p>
					</div>
				</div>
			</template>
			<template v-else-if="domainInfo.availability === 'error'">
				<div class="m-6 bg-red-50 border border-red-100 rounded-md p-3 flex gap-x-4 items-center">
					<div class="flex-grow text-center">
						<p class="text-lg mb-2">⚠️ Error loading domain info</p>
						<p class="mb-3">{{ whois }}</p>
						<p><strong>History</strong> and <strong>DNS Records</strong> tabs may have data loaded.</p>
					</div>
				</div>
			</template>
			<div v-else class="p-3">
				<p class="mb-3">Hmm, strange availability status for this domain..</p>

				<pre>{{ domainInfo }}</pre>
			</div>
		</template>
		<template v-else-if="view === 'whois'">
			<div v-if="states.whois === 'loading'" class="p-3 text-center dark:text-gray-300">Hang on tight, we're looking up the WHOIS info for this domain.</div>
			<div v-else-if="states.whois === 'error'" class="p-3 text-center dark:text-gray-300">⚠️ There was an error loading the WHOIS info for this domain.</div>
			<template v-else>
				<div class="p-3 dark:text-gray-300">
					<p v-if="whoisServers.length > 1" class="leading-5 mb-4">
						We found WHOIS info in Registry <code class="rounded p-1 bg-cyan-50 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300">{{ whoisServers[0] }}</code> and
						Registrar <code class="rounded p-1 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-300">{{ whoisServers[1] }}</code> servers. Data from Registrar is
						usually more complete, and the differences between them are highlighted below.
					</p>
					<p v-else class="leading-5 mb-4">
						This is the WHOIS data we found at the Registry WHOIS server
						<code class="rounded p-1 bg-cyan-50 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300">{{ whoisServers[0] }}</code>
					</p>

					<div class="flex items-center justify-endd">
						<div class="text-slate-600 dark:text-slate-300 pr-1">Data format:</div>
						<div class="bg-slate-50 dark:bg-slate-900 p-1 rounded-full">
							<button
								class="rounded-full py-1 px-2"
								:class="whoisView === 'table' ? 'bg-indigo-200 dark:bg-indigo-800' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900'"
								@click="whoisView = 'table'"
							>
								Table
							</button>
							<button
								class="rounded-full py-1 px-2 ml-1"
								:class="whoisView === 'json' ? 'bg-indigo-200 dark:bg-indigo-800' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900'"
								@click="whoisView = 'json'"
							>
								JSON
							</button>
							<!-- <button class="rounded-full py-1 px-2" :class="whoisView === 'raw' ? 'bg-indigo-200' : 'hover:bg-indigo-50'" @click="whoisView = 'raw'">Raw</button> -->
						</div>

						<template v-if="whoisView === 'table' && whoisServers.length > 1">
							<div class="text-slate-600 dark:text-slate-300 pl-4 pr-1">Data from:</div>
							<div class="bg-slate-50 dark:bg-slate-900 p-1 rounded-full">
								<button
									class="rounded-full py-1 px-2"
									:class="whoisData === 'registry' ? 'bg-violet-200 dark:bg-violet-800' : 'hover:bg-violet-50 dark:hover:bg-violet-900'"
									@click="whoisData = 'registry'"
								>
									Registry
								</button>
								<button
									class="rounded-full py-1 px-2 mx-1"
									:class="whoisData === 'registrar' ? 'bg-violet-200 dark:bg-violet-800' : 'hover:bg-violet-50 dark:hover:bg-violet-900'"
									@click="whoisData = 'registrar'"
								>
									Registrar
								</button>
								<button
									class="rounded-full py-1 px-2"
									:class="whoisData === 'both' ? 'bg-violet-200 dark:bg-violet-800' : 'hover:bg-violet-50 dark:hover:bg-violet-900'"
									@click="whoisData = 'both'"
								>
									Both
								</button>
							</div>
						</template>

						<label
							v-if="whoisView === 'table' && whoisServers.length > 1 && whoisData === 'both'"
							class="rounded-md py-1 px-2 ml-4 flex"
							:class="whoisDiff ? 'bg-yellow-50 dark:bg-yellow-900' : 'bg-slate-50 dark:bg-slate-900'"
						>
							<input type="checkbox" class="mr-2" v-model="whoisDiff" />
							<span class="text-slate-600 dark:text-slate-300">Highlight differences</span>
						</label>
					</div>
				</div>

				<table v-if="whoisView === 'table'" class="w-full">
					<template v-for="group in whoisGroup">
						<thead>
							<tr class="bg-stone-100 dark:bg-neutral-900 mt-2">
								<th class="pl-2 pr-1 py-1 text-left font-bold text-uppercase text-neutral-700 dark:text-neutral-200">{{ group.name }}</th>
								<th v-if="['registry', 'both'].includes(whoisData)" class="px-1 py-1 text-left text-neutral-500 dark:text-neutral-400">Registry data</th>
								<th v-if="whoisServers.length > 1 && ['registrar', 'both'].includes(whoisData)" class="px-1 py-1 text-left text-neutral-500 dark:text-neutral-400">
									Registrar data
								</th>
							</tr>
						</thead>
						<tbody>
							<template v-for="field in group.fields">
								<tr
									v-if="whois[whoisServers[0]][field] || whois[whoisServers[1]]?.[field]"
									class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
									:class="{ 'bg-amber-50 hover:bg-amber-100 dark:bg-yellow-950 hover:dark:bg-yellow-900': whoisDataDifferent(field) }"
								>
									<td class="pl-2 pr-1 py-2">{{ field }}</td>
									<td v-if="['registry', 'both'].includes(whoisData)" class="px-1 py-2">
										<template v-if="Array.isArray(whois[whoisServers[0]][field])">
											<p v-for="line in whois[whoisServers[0]][field]">{{ field === 'Domain Status' ? line.split(' ')[0] : line }}</p>
										</template>
										<template v-else>
											{{ whois[whoisServers[0]][field] }}
										</template>
									</td>
									<td v-if="whoisServers.length > 1 && ['registrar', 'both'].includes(whoisData)" class="px-1 py-2">
										<template v-if="Array.isArray(whois[whoisServers[1]][field])">
											<p v-for="line in whois[whoisServers[1]][field]">{{ field === 'Domain Status' ? line.split(' ')[0] : line }}</p>
										</template>
										<template v-else>
											{{ whois[whoisServers[1]][field] }}
										</template>
									</td>
								</tr>
							</template>
						</tbody>
					</template>

					<thead>
						<tr class="bg-stone-100 dark:bg-neutral-900 mt-2">
							<th class="pl-2 pr-1 py-1 text-left font-bold text-uppercase text-neutral-700 dark:text-neutral-200">Other info</th>
							<th v-if="['registry', 'both'].includes(whoisData)" class="px-1 py-1 text-left text-neutral-500 dark:text-neutral-400">Registry data</th>
							<th v-if="whoisServers.length > 1 && ['registrar', 'both'].includes(whoisData)" class="px-1 py-1 text-left text-neutral-500 dark:text-neutral-400">
								Registrar data
							</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="(value, field) in whois[whoisServers[1]] || whois[whoisServers[0]]">
							<tr
								v-if="!whoisGroupFields.includes(field)"
								class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
								:class="{ 'bg-amber-50 hover:bg-amber-100 dark:bg-yellow-950 hover:dark:bg-yellow-900': whoisDataDifferent(field) }"
							>
								<td class="pl-2 pr-1 py-2">{{ field }}</td>
								<td v-if="['registry', 'both'].includes(whoisData)" class="px-1 py-2">
									<template v-if="Array.isArray(whois[whoisServers[0]][field])">
										<p v-for="line in whois[whoisServers[0]][field]">{{ field === 'Domain Status' ? line.split(' ')[0] : line }}</p>
									</template>
									<template v-else>
										{{ whois[whoisServers[0]][field] }}
									</template>
								</td>
								<td v-if="whoisServers.length > 1 && ['registrar', 'both'].includes(whoisData)" class="px-1 py-2">
									<template v-if="Array.isArray(whois[whoisServers[1]][field])">
										<p v-for="line in whois[whoisServers[1]][field]">{{ line }}</p>
									</template>
									<template v-else>
										{{ whois[whoisServers[1]][field] }}
									</template>
								</td>
							</tr>
						</template>
					</tbody>
				</table>
				<div v-else-if="whoisView === 'json'" class="px-3">
					<pre class="bg-slate-50 dark:bg-slate-900 dark:text-slate-300 rounded-lg p-3"><code>{{ whois }}</code></pre>
				</div>

				<div class="bg-orange-50 dark:bg-amber-950 p-3 my-4 mx-3 rounded-md">
					<p class="text-lg font-bold mb-2 dark:text-slate-300"><span class="mr-1">💻</span> WHOIS data as JSON</p>
					<p class="text-sm mb-2 dark:text-slate-300">
						Do you want this data in JSON format for your project? Try out the <a href="https://docs.dmns.app/api" target="_blank" class="underline">Domains API</a>
					</p>
					<p class="text-sm mb-2 dark:text-slate-300">Getting WHOIS data is as simple as:</p>
					<pre class="text-pink-600 dark:text-pink-500">$ curl https://domains-api.com/domains/{{ domain }}/whois</pre>
				</div>
			</template>
		</template>
		<template v-else-if="view === 'history'">
			<div v-if="states.history === 'loading'" class="p-3 text-center dark:text-gray-200">Hang on tight, we're looking up the history for this domain.</div>
			<div v-else-if="states.history === 'error'" class="p-3 text-center dark:text-gray-200">⚠️ There was an error loading the history for this domain.</div>
			<div v-else class="p-3">
				<p v-if="history.length" class="mb-3 dark:text-gray-200">
					These are the changes we detected for this domain.
					<a :href="`https://dmns.app/${domain}?action=monitor&ref=browser-extension`" target="_blank" class="underline text-blue-800 dark:text-blue-300"
						>Monitor the domain</a
					>
					to get instant alerts when more changes are detected.
				</p>
				<div v-else class="m-6 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 rounded-md p-3 text-center dark:text-gray-200">
					<p class="text-lg mb-2">No changes detected for this domain, yet</p>
					<p>
						<a :href="`https://dmns.app/${domain}?action=monitor&ref=browser-extension`" target="_blank" class="underline text-blue-800 dark:text-blue-300"
							>Monitor the domain</a
						>
						to get instant alerts when a change is detected <a href="https://dmns.app/monitor-domains" target="_blank" class="inline-block ml-2">ℹ️</a>
					</p>
				</div>

				<div v-for="activity in history" class="border-l-2 border-neutral-300 dark:border-neutral-600 ml-3 py-3 pl-6 relative">
					<div v-if="activity.type === 'whois'">
						<div class="absolute bg-stone-100 dark:bg-stone-700 rounded-full text-lg leading-none p-2 mt-2" style="left: -17px">
							<template v-if="activity.detected_changes.includes('renewed')">🔁</template>
							<template v-else-if="activity.detected_changes.includes('transfer-completed')">🤝</template>
							<template v-else-if="activity.detected_changes.includes('transfer-unlock')">🔓</template>
							<template v-else-if="activity.detected_changes.includes('transfer-lock')">🔐</template>
							<template v-else>🕸️</template>
						</div>

						<div class="bg-stone-100 dark:bg-stone-800 dark:text-gray-200 rounded-lg p-3 mb-1">
							<h3 class="text-lg font-medium mb-3">{{ activity.detected_changes.length ? activity.text : `Changes detected in WHOIS` }}</h3>

							<template v-for="item in activity.data">
								<p v-if="item.kind === 'D'" class="bg-red-100 dark:bg-red-900 px-1 mb-1">{{ item.path[1] }}: {{ item.lhs }}</p>
								<p v-else-if="item.kind === 'A' && item.item.kind === 'D'" class="bg-red-100 dark:bg-red-900 px-1 mb-1">
									{{ item.path[1] }}, {{ item.index }}: {{ item.item.lhs }}
								</p>

								<p v-else-if="item.kind === 'N'" class="bg-green-100 dark:bg-green-900 px-1 mb-1">{{ item.path[1] }}: {{ item.rhs }}</p>
								<p v-else-if="item.kind === 'A' && item.item.kind === 'N'" class="bg-green-100 dark:bg-green-900 px-1 mb-1">
									{{ item.path[1] }}, {{ item.index }}: {{ item.item.rhs }}
								</p>

								<div v-if="item.kind === 'E' && item.path[1] !== 'Updated Date'" class="mb-1">
									<p class="bg-red-100 dark:bg-red-900 px-1">
										{{ item.path[1] }}: <span v-if="item.lhs" class="bg-red-200 dark:bg-red-800 px-1">{{ item.lhs }}</span>
									</p>
									<p class="bg-green-100 dark:bg-green-900 px-1">
										{{ item.path[1] }}: <span v-if="item.rhs" class="bg-green-200 dark:bg-green-800 px-1">{{ item.rhs }}</span>
									</p>
								</div>
							</template>
						</div>
						<p class="px-3 text-neutral-800 dark:text-neutral-400">
							<DateTime :date="new Date(activity.created_at)" :style="whoisTimeStyle" @click="switchWhoisTimeStyle"></DateTime>
							&middot; Source: WHOIS
						</p>
					</div>
					<div v-else-if="activity.type === 'sale'">
						<div class="absolute bg-emerald-100 dark:bg-emerald-700 rounded-full text-lg leading-none p-2 mt-2" style="left: -17px">💸</div>

						<div class="bg-emerald-50 dark:bg-emerald-900 dark:text-gray-200 rounded-lg p-3 mb-1">
							<h3 class="text-lg font-medium">{{ activity.text }}</h3>
						</div>
						<p class="px-3 text-neutral-800 dark:text-neutral-400">
							<DateTime :date="new Date(activity.created_at)" :style="whoisTimeStyle" @click="switchWhoisTimeStyle"></DateTime>
							&middot; Source: <a v-if="activity.data.source === 'namebio'" :href="`https://namebio.com/${domain}`" target="_blank">Namebio.com</a
							><template v-else>{{ activity.data.source }}</template>
						</p>
					</div>
					<div v-else-if="activity.type === 'url'">
						<div class="absolute bg-sky-100 dark:bg-sky-700 rounded-full text-lg leading-none p-2 mt-2" style="left: -17px">
							{{ activity.data.url.includes('twitter.com') ? '🐦' : '🔗' }}
						</div>

						<a :href="activity.data.url" target="_blank" class="block bg-sky-50 dark:bg-sky-950 dark:text-gray-200 rounded-lg p-3 mb-1">
							<h3 class="text-lg font-medium mb-2">{{ activity.data.title }}</h3>
							<p>{{ activity.data.description }}</p>
						</a>
						<p class="px-3 text-neutral-800 dark:text-neutral-400">
							<DateTime :date="new Date(activity.created_at)" :style="whoisTimeStyle" @click="switchWhoisTimeStyle"></DateTime>
							&middot; Source: {{ urlPart(activity.data.url, 'hostname') }}
						</p>
					</div>
					<div v-else-if="activity.type === 'note'">
						<div class="absolute bg-amber-100 dark:bg-amber-700 rounded-full text-lg leading-none p-2 mt-1" style="left: -17px">📝</div>

						<div class="bg-amber-50 dark:bg-amber-950 dark:text-gray-200 rounded-lg p-3 mb-1">
							<p>{{ activity.data }}</p>
						</div>
						<p class="px-3 text-neutral-800 dark:text-neutral-400">
							<DateTime :date="new Date(activity.created_at)" :style="whoisTimeStyle" @click="switchWhoisTimeStyle"></DateTime>
						</p>
					</div>

					<pre v-else class="mb-3 bg-stone-100 rounded-lg p-3">{{ activity }}</pre>
				</div>

				<div v-if="history.length && domainInfo.dates?.created" class="border-l-2 border-neutral-300 dark:border-neutral-600 ml-3 pt-3 pl-6 relative">
					<div class="absolute bg-neutral-100 dark:bg-neutral-700 rounded-full text-lg leading-none p-2 mt-1" style="left: -17px">🔘</div>

					<div class="bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg p-3 mb-1">
						<p>Domain is registered</p>
					</div>
					<p class="px-3 text-neutral-800 dark:text-neutral-400">
						<DateTime :date="new Date(domainInfo.dates.created)" :style="whoisTimeStyle" @click="switchWhoisTimeStyle"></DateTime>
					</p>
				</div>
			</div>
		</template>
		<template v-else-if="view === 'dns'">
			<div v-if="states.dns === 'error'" class="p-3 text-center">⚠️ There was an error loading the history for this domain.</div>

			<div
				v-else-if="domainInfo.availability === 'available'"
				class="m-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 dark:text-gray-200 rounded-md p-3 flex gap-x-4 items-center"
			>
				<img src="https://dmns.app/images/plan-pro.png" class="flex-none" width="100" height="100" />

				<div class="flex-grow">
					<p class="text-lg mb-2">No DNS Records</p>
					<p>Because this domain is not yet registered.</p>
				</div>
			</div>

			<div v-else-if="states.dns === 'loaded' && !records.length" class="m-6 bg-indigo-50 border border-indigo-100 rounded-md p-3 flex gap-x-4 items-center">
				<img src="https://dmns.app/images/plan-pro.png" class="flex-none" width="100" height="100" />

				<div class="flex-grow">
					<p class="text-lg mb-3">No DNS Records found</p>
					<p class="mb-2">We scoured the internet, and couldn't find any..</p>
					<p class="">
						<a :href="`https://dmns.app/${domain}?action=monitor&ref=browser-extension`" target="_blank" class="underline text-blue-800 dark:text-blue-300"
							>Monitor the domain</a
						>
						to get instant alerts when a change is detected
					</p>
				</div>
			</div>

			<template v-else>
				<div class="p-3 flex items-center">
					<div class="flex-grow">
						<p class="dark:text-gray-50">
							The DNS Records for this domain
							<img
								v-if="states.dns === 'loading'"
								src="/three-dots.svg"
								class="inline bg-slate-300 dark:bg-slate-900 rounded ms-1 px-2 py-1"
								width="48"
								alt="Loader"
							/>
						</p>
					</div>
					<a
						:href="`https://dmns.app/${domain}/dns-records?action=download-zone-file`"
						target="_blank"
						class="block rounded-full py-1 px-3 bg-indigo-200 hover:bg-indigo-300 text-gray-800 dark:bg-gray-800 hover:dark:bg-gray-700 dark:text-gray-200"
						>Download zone file</a
					>
				</div>

				<table class="w-full mb-3">
					<thead>
						<tr class="bg-neutral-100 dark:bg-neutral-900">
							<th class="text-left py-1 pl-2 pr-1 text-neutral-700 dark:text-neutral-200">NS &amp; Security</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">Name</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">TTL</th>
							<th class="text-left py-1 pl-1 pr-2 text-neutral-500 dark:text-neutral-400">Value</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-if="records.find(r => r.type === 'NS')"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1">
								<span class="inline-block font-medium px-1 rounded bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-500">NS</span>
							</td>
							<td class="py-2 px-1">{{ domain }}</td>
							<td class="py-2 px-1">{{ records.find(r => r.type === 'NS').ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="record in records.filter(r => r.type === 'NS')" class="mb-1 last:mb-0">{{ record.data }}</p>
							</td>
						</tr>
						<tr
							v-for="record in records.filter(r => ['CAA', 'SOA'].includes(r.type))"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1">
								<span class="inline-block font-medium px-1 rounded bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-500">{{ record.type }}</span>
							</td>
							<td class="py-2 px-1">{{ record.name }}</td>
							<td class="py-2 px-1">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">{{ record.data }}</td>
						</tr>
					</tbody>

					<thead>
						<tr class="bg-neutral-100 dark:bg-neutral-900">
							<th class="text-left py-1 pl-2 pr-1 text-neutral-700 dark:text-neutral-200">(Sub)domains</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">Name</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">TTL</th>
							<th class="text-left py-1 pl-1 pr-2 text-neutral-500 dark:text-neutral-400">Value</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="record in recordsGrouped.A"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1 align-top">
								<span class="inline-block font-medium px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400">A</span>
							</td>
							<td class="py-2 px-1 align-top">{{ record.name }}</td>
							<td class="py-2 px-1 align-top">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="value in record.data" class="break-all mb-1 last:mb-0">
									<span class="inline-block rounded px-1 hover:bg-neutral-200 dark:hover:bg-gray-700" @click="$event => copyText($event, value)">{{
										value
									}}</span>
									<span v-if="ipInfo[value]" class="ml-2 inline-block rounded px-1 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
										>{{ countryCodeToFlag(ipInfo[value].country_code) }} {{ ipInfo[value].country }} &middot; {{ ipInfo[value].as_name }} ({{
											ipInfo[value].asn
										}})</span
									>
								</p>
							</td>
						</tr>
						<tr
							v-for="record in recordsGrouped.AAAA"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1 align-top">
								<span class="inline-block font-medium px-1 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-400">AAAA</span>
							</td>
							<td class="py-2 px-1 align-top">{{ record.name }}</td>
							<td class="py-2 px-1 align-top">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="value in record.data" class="break-all mb-1 last:mb-0">
									<span class="inline-block rounded px-1 hover:bg-neutral-200 dark:hover:bg-gray-700" @click="$event => copyText($event, value)">{{
										value
									}}</span>
									<span v-if="ipInfo[value]" class="ml-2 inline-block rounded px-1 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
										>{{ countryCodeToFlag(ipInfo[value].country_code) }} {{ ipInfo[value].country }} &middot; {{ ipInfo[value].as_name }} ({{
											ipInfo[value].asn
										}})</span
									>
								</p>
							</td>
						</tr>
						<tr
							v-for="record in recordsGrouped.CNAME"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1 align-top">
								<span class="inline-block font-medium px-1 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-400">CNAME</span>
							</td>
							<td class="py-2 px-1 align-top">{{ record.name }}</td>
							<td class="py-2 px-1 align-top">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="value in record.data" class="break-all mb-1 last:mb-0">{{ value }}</p>
							</td>
						</tr>
					</tbody>

					<thead>
						<tr class="bg-neutral-100 dark:bg-neutral-900">
							<th class="text-left py-1 pl-2 pr-1 text-neutral-700 dark:text-neutral-200">MX (email)</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">Name</th>
							<th class="text-left text-neutral-500 p-1 dark:text-neutral-400">TTL</th>
							<th class="text-left py-1 pl-1 pr-2 text-neutral-500 dark:text-neutral-400">Value</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-if="records.find(r => r.type === 'MX')"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1 align-top">
								<span class="inline-block font-medium px-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">MX</span>
							</td>
							<td class="py-2 px-1 align-top">{{ domain }}</td>
							<td class="py-2 px-1 align-top">{{ records.find(r => r.type === 'MX').ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="record in records.filter(r => r.type === 'MX')" class="mb-1 last:mb-0">{{ record.data }}</p>
							</td>
						</tr>
						<tr v-else>
							<td colspan="4" class="p-2">
								<p class="text-center text-neutral-600 dark:text-neutral-400 italic">No MX records found, this domain can't receive emails</p>
							</td>
						</tr>
					</tbody>

					<thead>
						<tr class="bg-neutral-100 dark:bg-neutral-900">
							<th class="text-left py-1 pl-2 pr-1 text-neutral-700 dark:text-neutral-200">TXT/other</th>
							<th class="text-left p-1 text-neutral-500 dark:text-neutral-400">Name</th>
							<th class="text-left p-1 text-neutral-500 dark:text-neutral-400">TTL</th>
							<th class="text-left py-1 pl-1 pr-2 text-neutral-500 dark:text-neutral-400">Value</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="record in recordsGrouped.TXT"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1 align-top">
								<span class="inline-block font-medium px-1 rounded bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-400">{{ record.type }}</span>
							</td>
							<td class="py-2 px-1 align-top">{{ record.name }}</td>
							<td class="py-2 px-1 align-top">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">
								<p v-for="value in record.data" class="break-all mb-1 last:mb-0">{{ value }}</p>
							</td>
						</tr>
						<tr
							v-for="record in records.filter(r => r.type && !['NS', 'SOA', 'CAA', 'MX', 'A', 'AAAA', 'CNAME', 'TXT'].includes(r.type))"
							class="border-b border-slate-100 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-gray-900 dark:border-slate-900"
						>
							<td class="py-2 pl-2 pr-1">
								<span class="inline-block font-medium px-1 rounded bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-400">{{ record.type }}</span>
							</td>
							<td class="py-2 px-1">{{ record.name }}</td>
							<td class="py-2 px-1">{{ record.ttl }}</td>
							<td class="py-2 pl-1 pr-2">{{ record.data }}</td>
						</tr>
					</tbody>
				</table>

				<div class="bg-orange-50 dark:bg-amber-950 p-3 my-4 mx-3 rounded-md">
					<p class="text-lg font-bold mb-2 dark:text-slate-300"><span class="mr-1">💻</span> DNS Records as JSON</p>
					<p class="text-sm mb-2 dark:text-slate-300">
						Do you want this data in JSON format for your project? Try out the <a href="https://docs.dmns.app/api" target="_blank" class="underline">Domains API</a>
					</p>
					<p class="text-sm mb-2 dark:text-slate-300">Getting DNS data is as simple as:</p>
					<pre class="text-pink-600 dark:text-pink-500">$ curl https://domains-api.com/domains/{{ domain }}/dns-records</pre>
				</div>
			</template>
		</template>
		<div v-else class="p-3">
			<pre>{{ domainInfo }}</pre>
		</div>
	</template>
	<div v-else-if="tabType === 'ip'" class="p-5 dark:text-neutral-100">
		<h3 class="text-xl text-center">This is an IP 😑 try another tab</h3>
	</div>
	<div v-else-if="tabType === 'invalid'" class="p-5 dark:text-neutral-100">
		<h3 v-if="domain === 'localhost'" class="text-2xl text-center">It's localhost 🤨 what would you expect here?</h3>
		<h3 v-else class="text-xl text-center">A fine domain choice 🥸 but it doesn't fly on the real internet</h3>
	</div>
</template>
