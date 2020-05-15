<template>
	<div class="app-popup">
		<h2 v-if="!domainRoot" class="text-center my-3">{{ domain }}</h2>
		<h2 v-if="domainRoot" class="text-center my-3">
			<span class="text-muted">{{ domain.replace(domainRoot, '') }}</span
			>{{ domainRoot }}
		</h2>

		<div v-if="valid">
			<ul class="nav nav-tabs sticky-top bg-white">
				<li v-for="(tab, index) in tabs" v-bind:key="tab.title" class="nav-item">
					<span class="nav-link text-center cursor-pointer" :class="{ active: index === tabActive, error: tab.status === 'error' }" @click="tabActive = index">
						<strong>{{ tab.title }}</strong>
						<br />
						<small>{{ tab.subtitle || '..' }}</small>
					</span>
				</li>
			</ul>

			<div v-for="(tab, index) in tabs" v-bind:key="tab.title" v-if="index === tabActive" class="py-2">
				<div v-if="tab.status === 'loaded'">
					<div v-if="tab.title === 'NS'" class="bg-light rounded p-2 mb-3">
						<table class="table table-hover">
							<thead>
								<tr>
									<th>NameServer</th>
									<th>SOA Serial</th>
									<th>IP</th>
									<th>Response Time</th>
									<!--
									<th>Location</th>
									<th>ISP</th>
									-->
								</tr>
							</thead>
							<tbody>
								<tr v-for="ns in data.ns">
									<td>{{ ns.ns }}</td>
									<td>{{ ns.soaSerial }}</td>
									<td>
										<p v-for="ip in ns.IPv4" class="mb-1">{{ ip }}</p>
										<p v-for="ip in ns.IPv6" class="mb-1">{{ ip }}</p>
									</td>
									<td>
										<p v-for="time in ns.responseTimev4" class="mb-1">
											<span v-if="time">{{ time }}ms</span>
											<span v-else class="text-muted">couldn't get</span>
										</p>
										<p v-for="time in ns.responseTimev6" class="mb-1">
											<span v-if="time">{{ time }}ms</span>
											<span v-else class="text-muted">couldn't get</span>
										</p>
									</td>
									<!--
									<td>..</td>
									<td>..</td>
									-->
								</tr>
							</tbody>
						</table>
					</div>
					<div v-else-if="tab.title === 'DNS'" class="bg-light rounded p-2 mb-3">
						<table class="table table-sm table-hover">
							<thead>
								<tr>
									<th>Type</th>
									<th>Name</th>
									<th>TTL</th>
									<th>Content</th>
								</tr>
							</thead>
							<tbody v-for="(group, type) in data.dns">
								<tr v-for="dns in group">
									<td>
										<span
											class="badge"
											:class="{
												'badge-secondary': ['NS', 'SOA'].includes(dns.type),
												'badge-success': ['A', 'AAAA', 'CNAME'].includes(dns.type),
												'badge-primary': ['MX', 'TXT'].includes(dns.type),
												'badge-info': !['NS', 'SOA', 'A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(dns.type),
											}"
											>{{ dns.type }}</span
										>
									</td>
									<td>
										<span :class="{ 'badge badge-light': isWildcardSubdomain(dns.name) }">{{ dns.name }}</span>
									</td>
									<td>
										<span class="ttl">{{ toTime(dns.ttl) }}</span>
									</td>
									<td>
										<p v-for="value in dns.value" class="mb-1">{{ value }}</p>
									</td>
								</tr>
								<tr v-if="!group.length">
									<td>
										<span class="badge badge-light">{{ type }}</span>
									</td>
									<td colspan="3" class="text-muted">No {{ type }} records</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div v-else-if="tab.title === 'WHOIS'">
						<div v-for="group in whoisGroup" class="bg-light rounded p-2 mb-3">
							<h4>{{ group.title }}</h4>

							<table class="table table-hover">
								<tbody>
									<tr v-for="(content, label) in tab.content" v-if="group.fields.includes(label)">
										<th>{{ label }}</th>
										<td>
											<div v-if="typeof content === 'string'">{{ content }}</div>
											<div v-else>
												<p class="mb-1" v-for="contentItem in content">{{ contentItem }}</p>
											</div>
										</td>
										<td v-if="!delete tab.content2[label]">!</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div class="bg-light rounded p-2 mb-3">
							<h4>WHOIS Info</h4>
							<pre>{{ toJson(tab.content2) }}</pre>
						</div>
					</div>
					<div v-else-if="tab.title === 'Overview'" class="box">
						<div class="row mt-2 mb-3">
							<div class="col-auto text-center">
								<h4 class="text-capitalize rounded px-2 py-1 mb-1" :class="[`badge-${tab.content.availability}`]">{{ tab.content.availability }}</h4>
								<span v-if="tab.content.availability === 'registered' && tab.content.registrar.name" class="text-muted">
									at
									<a v-if="tab.content.registrar.url" target="_blank" :href="tab.content.registrar.url">{{ tab.content.registrar.name }}</a>
									<span v-else>{{ tab.content.registrar.name }}</span>
								</span>
							</div>
							<div class="col">
								<span v-for="status in tab.content.status" class="badge badge-light m-1">{{ status }}</span>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered'" class="bg-light rounded p-3 mb-3">
							<div class="row align-items-center text-center">
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.created">{{ formatDate(tab.content.dates.created) }}</strong>
										<i v-if="!tab.content.dates.created" class="text-muted"><small>unknown</small></i>
									</p>
									<p class="text-uppercase text-muted mb-0">Created</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.updated">{{ formatDate(tab.content.dates.updated) }}</strong>
										<i v-if="!tab.content.dates.updated" class="text-muted"><small>unknown</small></i>
									</p>
									<p class="text-uppercase text-muted mb-0">Updated</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.expiry">{{ formatDate(tab.content.dates.expiry) }}</strong>
										<i v-if="!tab.content.dates.expiry" class="text-muted"><small>unknown</small></i>
									</p>
									<p v-if="tab.content.dates.expiry && inDays(tab.content.dates.expiry) >= 0" class="text-uppercase text-muted mb-0">
										Expires in {{ inDays(tab.content.dates.expiry) }} days
									</p>
									<p v-else-if="tab.content.dates.expiry && inDays(tab.content.dates.expiry) < 0" class="text-uppercase text-muted mb-0">
										Expired <span class="badge badge-warning">{{ inDays(tab.content.dates.expiry) * -1 }} days ago</span>
									</p>
									<p v-else class="text-uppercase text-muted mb-0">Expires</p>
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered'" class="bg-light rounded p-3 mb-3">
							<div class="row align-items-center">
								<div class="col-auto">
									<img
										:src="getPicture(tab.content.registrant.email || '')"
										@error="$event.target.src = 'https://files.layered.market/neutral-2.png'"
										width="50"
										class="rounded"
										alt="Registrant"
									/>
								</div>
								<div class="col">
									<p class="mb-1 lead" v-html="uniqueValues([tab.content.registrant.name, tab.content.registrant.organization], 'Anonymous')"></p>
									<p class="mb-1" v-html="uniqueValues([tab.content.registrant.city, tab.content.registrant.stateOrProvince, tab.content.registrant.country])"></p>
									<p class="mb-0" v-html="uniqueValues([tab.content.registrant.phone, tab.content.registrant.email], 'No contact info found')"></p>
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered' && !tab.content.status.includes('inactive')" class="bg-light rounded p-3 mb-3">
							<div class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">Name Servers</span>
								</div>
								<div class="col">
									<span v-for="ns in (tab.content.ns.length > 5 ? tab.content.ns.slice(0, 4) : tab.content.ns)" class="badge badge-light-secondary text-lowercase mr-1 mb-1">{{ ns }}</span>
									<small v-if="tab.content.ns.length > 5" class="text-primary cursor-pointer" @click="tabActive = tabs.length - 3">and {{ tab.content.ns.length - 4 }} more</small>
								</div>
							</div>
							<div v-if="tab.content.services.dns.length" class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">DNS provider</span>
								</div>
								<div class="col">
									<a v-for="dnsProvider in tab.content.services.dns" :key="dnsProvider.name" :href="dnsProvider.url" class="mr-2" target="_blank">
										<img :src="dnsProvider.logo" width="14" class="rounded mr-1" alt="DNS provider" />
										{{ dnsProvider.name }}
									</a>
								</div>
							</div>
							<div v-if="data.dns" class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">DNS Records</span>
								</div>
								<div class="col">
									<span v-for="dns in (Object.values(data.dns).flat().length > 6 ? [...data.dns.A, ...data.dns.CNAME].slice(0, 5) : [...data.dns.A, ...data.dns.CNAME])" class="badge badge-light text-lowercase mr-1 mb-1">{{ dns.name }}</span>
									<span v-if="Object.values(data.dns).flat().length > 6" class="text-primary cursor-pointer" @click="tabActive = tabs.length - 1">and {{ Object.values(data.dns).flat().length - 5 }} more</span>
								</div>
							</div>
							<div v-if="data.emailProvider" class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">Email provider</span>
								</div>
								<div class="col">
									<a :href="data.emailProvider.url" target="_blank">
										<img :src="data.emailProvider.logo" width="14" class="rounded mr-1" alt="Email provider" />
										{{ data.emailProvider.name }}
									</a>
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'available'" class="bg-light rounded p-3 mb-3">
							<p class="lead"><strong>{{ domainRoot || domain }}</strong> is available to register:</p>
							<p>
								<a v-for="buy in tab.content.services.buy" :key="buy.name" :href="buy.url" class="btn btn-outline-primary mx-1" target="_blank">{{ buy.name }}</a>
							</p>
						</div>

						<div class="bg-light rounded p-3 mb-3">
							<h5 class="subtitle">Other TLDs for {{ domainRoot || domain }}</h5>

							<p class="mb-0">
								<a v-for="tld in tlds" :href="'http://' + data.domain.keyword + '.' + tld.tld" v-bind:key="tld.tld" class="btn btn-sm mx-1" target="_blank" :class="{'btn-outline-primary': tld.status === 'available', 'btn-outline-secondary': !['available'].includes(tld.status)}">
									<span v-if="tld.status === 'loading'">.{{ tld.tld }} <div class="spinner-border spinner-border-sm" role="status"></div></span>
									<span v-else>.{{ tld.tld }} - {{ tld.status }}</span>
								</a>
							</p>
						</div>
					</div>
					<div v-else class="box">
						<pre>{{ tab.content }}</pre>
					</div>
				</div>
				<div v-else-if="tab.status === 'loading'">
					<div class="d-flex justify-content-center">
						<div class="spinner-border text-primary my-3" role="status">
							<span class="sr-only">Loading...</span>
						</div>
					</div>
				</div>
				<div v-else-if="tab.status === 'error'" class="alert alert-danger">
					{{ tab.content }}
				</div>
			</div>
		</div>
		<div v-else class="text-center alert alert-warning">Not a valid domain, can't get WHOIS or DNS data</div>
	</div>
</template>

<script>
import md5 from 'blueimp-md5'
console.log = chrome.extension.getBackgroundPage().console.log

export default {
	data() {
		return {
			domain: '-',
			domainRoot: '',
			valid: false,
			tabs: [],
			tabActive: 0,
			tlds: {},
			data: {
				domain: null,
				whois: null,
				ns: null,
				dns: null,
				emailProvider: null,
				dnsProviders: [],
			},
			whoisGroup: [
				{
					title: 'Domain Info',
					fields: [
						'Domain Name',
						'Domain Status',
						'Name Server',
						'Domain nameservers',
						'ROID',
						'Registry Domain ID',
						'IDN',
						'Whoisprivacy',
						'Created Date',
						'Updated Date',
						'Expiry Date',
						'free-date',
						'Registration status',
						'DNSSEC',
						'DNSSEC DS Data',
						'Error',
						'ERROR',
					],
				},
				{
					title: 'Registrar',
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
					],
				},
				{
					title: 'Contact - Registrant',
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
					title: 'Contact - Admin',
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
					title: 'Contact - Tech',
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
					title: 'Contact - Billing',
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
		}
	},
	created() {
		const allowedProtocols = ['http:', 'https:']

		chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
			const url = new URL(tabs[0].url)

			this.domain = url.hostname
			this.valid = allowedProtocols.includes(url.protocol) && url.hostname.includes('.')

			if (this.valid) this.loadInfo()
		})
	},
	methods: {
		loadInfo() {
			const tldsToCheck = ['com', 'net', 'org', 'co']
			const tabOverview = {
				title: 'Overview',
				subtitle: '',
				content: 'Loading..',
				status: 'loading',
			}

			const tabWhois = {
				title: 'WHOIS',
				subtitle: '',
				content: 'loading WHOIS',
				status: 'loading',
			}

			const tabNs = {
				title: 'NS',
				subtitle: '',
				content: 'loading NS',
				status: 'loading',
			}

			const tabDns = {
				title: 'DNS',
				subtitle: '',
				content: 'loading DNS',
				status: 'loading',
			}

			}

			// Get WHOIS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/domain/${this.domain}?detailed=1`,
				})
				.then(re => {
					if (re.error) {
						throw re.error
					}

					// add domain info
					this.domainRoot = re.domain
					this.data.domain = re
					tabOverview.status = 'loaded'
					tabOverview.subtitle = re.availability
					tabOverview.content = re

					// add whois data
					this.data.whois = re.whois
					let i = 0
					Object.keys(this.data.whois).forEach(whoisServer => {
						if (i === 0) {
							tabWhois.status = 'loaded'
							tabWhois.subtitle = whoisServer
							tabWhois.whoisType = 'Registry'
							tabWhois.content = this.data.whois[whoisServer]
						} else {
							this.tabs.splice(i + 1, 0, {
								status: 'loaded',
								title: 'WHOIS',
								subtitle: whoisServer,
								whoisType: 'Registrar',
								content: this.data.whois[whoisServer],
							})
						}

						i++
					})
				})
				.catch(err => {
					tabOverview.status = 'error'
					tabOverview.subtitle = 'error'
					tabOverview.content = err

					tabWhois.status = 'error'
					tabWhois.subtitle = 'error'
					tabWhois.content = err
				})

			// Get NS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/domain/${this.domain}/name-servers`,
				})
				.then(nsResponse => {
					if (nsResponse.error) {
						throw nsResponse.error
					}

					this.data.ns = nsResponse
					tabNs.status = 'loaded'
					tabNs.subtitle = `${nsResponse.length} found`
					tabNs.content = JSON.stringify(nsResponse, null, 2)
				})
				.catch(err => {
					tabNs.status = 'error'
					tabNs.subtitle = 'error'
					tabNs.content = err
				})

			// Get DNS records
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/domain/${this.domain}/dns-records`,
				})
				.then(dnsResponse => {
					if (dnsResponse.error) {
						throw dnsResponse.error
					}

					const dnsData = {}

					for (const recordType in dnsResponse) {
						dnsData[recordType] = {}

						dnsResponse[recordType].forEach(record => {
							const group = `${record.type}-${record.name}-${record.ttl}`

							if (!dnsData[recordType][group]) {
								dnsData[recordType][group] = {
									name: record.name,
									type: record.type,
									ttl: record.ttl,
									value: [],
								}
							}

							dnsData[recordType][group].value.push(record.value)
						})

						dnsData[recordType] = Object.values(dnsData[recordType])
					}

					if (dnsData.MX.length) {
						this.idMX(dnsData.MX[0].value)
					}

					this.data.dns = dnsData
					tabDns.status = 'loaded'
					tabDns.subtitle = dnsResponse.NS[0].value
					tabDns.content = JSON.stringify(dnsResponse, null, 2)
				})
				.catch(err => {
					tabDns.status = 'error'
					tabDns.subtitle = 'error'
					tabDns.content = err
				})
		},
		uniqueValues(values, defaultValue) {
			if (defaultValue) {
				defaultValue = `<i class="text-muted">${defaultValue}</i>`
			}
			return [...new Set(values)].filter(Boolean).join(', ') || defaultValue
		},
		isWildcardSubdomain(subdomain) {
			return subdomain.startsWith('*.')
		},
		toTime(seconds) {
			let txt = seconds + 's'

			if (seconds >= 86400) {
				const days = Math.round(seconds / 86400)
				txt = days + (days === 1 ? ' day' : ' days')
			} else if (seconds >= 3600) {
				const hours = Math.round(seconds / 3600)
				txt = hours + (hours === 1 ? ' hour' : ' hours')
			} else if (seconds >= 60) {
				const minutes = Math.round(seconds / 60)
				txt = minutes + (minutes === 1 ? ' min' : ' mins')
			}

			return txt
		},
		toJson(data) {
			return JSON.stringify(data, null, 2)
		},
		formatDate(date) {
			date = new Date(date.trim())

			return date.toLocaleDateString()
		},
		inDays(date, toDate) {
			const t1 = new Date(date.trim())
			const t2 = toDate || new Date()

			return Math.round((t1.getTime() - t2.getTime()) / (24 * 3600 * 1000))
		},
		getPicture(email) {
			const imgClearbit = `https://logo.clearbit.com/${this.domainRoot || this.domain}?size=50`

			return email && this.isEmail(email) ? `https://www.gravatar.com/avatar/${md5(email)}?s=50&d=${imgClearbit}` : imgClearbit
		},
		isEmail(email) {
			const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
			return emailRegex.test(email.toLowerCase())
		},
		idMX(mxRecords) {
			const mxServers = {
				'emailsrvr.com': {
					name: 'Rackspace Email',
					url: 'https://www.rackspace.com/email-hosting/webmail',
					logo: 'https://www.rackspace.com/themes/custom/rackspace/favicon.ico',
				},
				'gmr-smtp-in.l.google.com': {
					name: 'Gmail',
					url: 'https://www.google.com/gmail/about/',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'googlemail.com': {
					name: 'Google G Suite',
					url: 'https://refergsuite.app.goo.gl/1WTE',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'google.com': {
					name: 'Google G Suite',
					url: 'https://refergsuite.app.goo.gl/1WTE',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'outlook.com': {
					name: 'Outlook',
					url: 'https://products.office.com/en/outlook/email-and-calendar-software-microsoft-outlook',
					logo: 'https://logo.clearbit.com/microsoft.com',
				},
				'secureserver.net': {
					name: 'GoDaddy',
					url: 'https://www.godaddy.com/email',
					logo: 'https://img1.wsimg.com/ux/favicon/favicon-96x96.png',
				},
			}

			for (const mxServer in mxServers) {
				mxRecords.forEach(mxRecord => {
					if (mxRecord.toLowerCase().includes(mxServer)) {
						this.data.emailProvider = mxServers[mxServer]
						return true
					}
				})
			}

			return false
		},
	},
}
</script>

<style lang="scss" scoped>
// Layered Design System variables
@import '~@layered/layered-design/src/variables';

// Bootstrap files below

// Configuration
@import '~bootstrap/scss/functions';
@import '~bootstrap/scss/variables';
@import '~bootstrap/scss/mixins';

// Layout & components
@import '~bootstrap/scss/root';
@import '~bootstrap/scss/reboot';
@import '~bootstrap/scss/type';
//@import '~bootstrap/scss/images';
//@import '~bootstrap/scss/code';
@import '~bootstrap/scss/grid';
@import '~bootstrap/scss/tables';
//@import '~bootstrap/scss/forms';
@import '~bootstrap/scss/buttons';
@import '~bootstrap/scss/transitions';
// @import "~bootstrap/scss/dropdown";
// @import "~bootstrap/scss/button-group";
// @import "~bootstrap/scss/input-group";
// @import "~bootstrap/scss/custom-forms";
@import '~bootstrap/scss/nav';
//@import "~bootstrap/scss/navbar";
//@import "~bootstrap/scss/card";
//@import "~bootstrap/scss/breadcrumb";
//@import "~bootstrap/scss/pagination";
@import '~bootstrap/scss/badge';
//@import "~bootstrap/scss/jumbotron";
@import '~bootstrap/scss/alert';
//@import "~bootstrap/scss/progress";
//@import "~bootstrap/scss/media";
//@import "~bootstrap/scss/list-group";
//@import "~bootstrap/scss/close";
//@import "~bootstrap/scss/toasts";
//@import "~bootstrap/scss/modal";
//@import '~bootstrap/scss/tooltip';
//@import "~bootstrap/scss/popover";
//@import "~bootstrap/scss/carousel";
@import '~bootstrap/scss/spinners';
@import '~bootstrap/scss/utilities';
//@import "~bootstrap/scss/print";

// Layered Design System overrides
@import '~@layered/layered-design/src/reboot';
@import '~@layered/layered-design/src/type';
//@import '~@layered/layered-design/src/images';
@import '~@layered/layered-design/src/buttons';
@import '~@layered/layered-design/src/nav';
//@import '~@layered/layered-design/src/navbar';
//@import '~@layered/layered-design/src/card';
//@import '~@layered/layered-design/src/toasts';
@import '~@layered/layered-design/src/ui-elements';

.app-popup {
	height: 400px;
	width: 600px;
	cursor: default;
}

.nav-tabs {
	.nav-link.error {
		border-color: #f5c6cb;
	}
	.nav-link.active.error {
		border-color: #721c24;
	}
}

.badge {
	font-size: 90% !important;
}
.badge-registered {
	color: $primary;
	background-color: $primary-lighter;
}
.badge-available {
	color: #004085;
	background-color: #cce5ff;
}
.badge-reserved,
.badge-unknown {
	color: #856404;
	background-color: #fff3cd;
}

.ttl {
	display: inline-block;
	min-width: 50px;
}
</style>
