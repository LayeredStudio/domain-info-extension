<template>
	<div class="app-popup">
		<h2 v-if="!domainRoot" class="text-center">{{ domain }}</h2>
		<h2 v-if="domainRoot" class="text-center">
			<span class="text-muted">{{ domain.replace(domainRoot, '') }}</span>{{ domainRoot }}
		</h2>

		<p v-if="!valid" class="text-center alert">Not a valid domain, no WHOIS or DNS</p>

		<div v-if="valid" class="tabs">
			<ul>
				<li v-for="(tab, index) in tabs" :class="{ active: index === tabActive, error: tab.status === 'error' }" @click="tabActive = index">
					<strong>{{ tab.title }}</strong>
					<br /><small>{{ tab.subtitle || '..' }}</small>
				</li>
			</ul>

			<div v-for="(tab, index) in tabs" v-if="index === tabActive" class="tab-content">
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
										<td v-if="!(delete tab.content2[label] && group.found++)">!</td>
									</tr>
								</tbody>
							</table>

							<div v-if="!group.found">
								<p class="text-muted">No data found..</p>
							</div>
						</div>

						<div class="bg-light rounded p-2 mb-3">
							<h4>WHOIS Info</h4>
							<pre>{{ toJson(tab.content2) }}</pre>
						</div>
					</div>
					<div v-else-if="tab.title === 'Overview'" class="box">
						<div class="row mt-4 mb-3">
							<div class="col-auto text-center">
								<h4 class="text-capitalize rounded px-2 py-1 mb-1" :class="[`badge-${tab.content.status}`]">{{ tab.content.status }}</h4>
								<span v-if="tab.content.status === 'registered' && tab.content.registrar.name" class="text-muted">
									at
									<a
										v-if="tab.content.registrar.url"
										target="_blank"
										:href="(tab.content.registrar.url.includes('://') ? '' : 'http://') + tab.content.registrar.url"
										>{{ tab.content.registrar.name }}</a
									>
									<span v-else>{{ tab.content.registrar.name }}</span>
								</span>
							</div>
							<div class="col">
								<span v-for="status in tab.content.statusExtra" class="badge badge-light m-1">{{ status }}</span>
							</div>
						</div>

						<div v-if="tab.content.status === 'registered'" class="bg-light rounded p-3 mb-3">
							<div class="row align-items-center text-center">
								<div class="col">
									<p class="mb-2 lead">
										<strong>{{ formatDate(tab.content.dates.created) }}</strong>
									</p>
									<p class="text-uppercase text-muted mb-0">Created</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong>{{ formatDate(tab.content.dates.updated) }}</strong>
									</p>
									<p class="text-uppercase text-muted mb-0">Updated</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong>{{ formatDate(tab.content.dates.expiry) }}</strong>
									</p>
									<p class="text-uppercase text-muted mb-0">Expires in {{ inDays(tab.content.dates.expiry) }} days</p>
								</div>
							</div>
						</div>

						<div v-if="tab.content.status === 'registered' && data.whoisD" class="bg-light rounded p-3 mb-3">
							<div class="row align-items-center">
								<div class="col-auto">
									<img
										:src="getPicture(data.whoisD['Registrant Email'] || '')"
										@error="$event.target.src = 'https://files.layered.market/neutral-2.png'"
										width="50"
										class="rounded"
										alt="Registrant"
									/>
								</div>
								<div class="col">
									<p class="mb-1 lead">
										{{
											Array.from(
												new Set(
													[data.whoisD['Registrant Name'], data.whoisD['Registrant Organization'], data.whoisD['Registrant Organisation']].filter(Boolean)
												)
											).join(', ') || 'Anonymous'
										}}
									</p>
									<p class="mb-1">
										{{
											Array.from(
												new Set(
													[
														data.whoisD['Registrant City'],
														data.whoisD['Registrant State/Province'],
														data.whoisD['Registrant State'],
														data.whoisD['Registrant Country'],
													].filter(Boolean)
												)
											).join(', ')
										}}
									</p>
									<p class="mb-0">{{ Array.from(new Set([data.whoisD['Registrant Phone'], data.whoisD['Registrant Email']].filter(Boolean))).join(', ') }}</p>
								</div>
							</div>
						</div>

						<div v-if="tab.content.status === 'available'" class="bg-light rounded p-3 mb-3">
							<p class="lead">Great news, this domain is available for registration!</p>
							<p>
								Register now with
								<a :href="'https://domains.google.com/m/registrar/search?searchTerm=' + (domainRoot || domain)" target="_blank">Google Domains</a>,
								<a :href="'https://porkbun.com/checkout/search?q=' + (domainRoot || domain)" target="_blank">PorkBun</a> or
								<a :href="'https://www.godaddy.com/domainsearch/find?domainToCheck=' + (domainRoot || domain)" target="_blank">GoDaddy</a>.
							</p>
						</div>
					</div>
					<div v-else class="box">
						<pre>{{ tab.content }}</pre>
					</div>
				</div>
				<div v-else-if="tab.status === 'loading'">
					<p class="text-center">Loading..</p>
				</div>
				<div v-else-if="tab.status === 'error'" class="alert alert-danger">
					{{ tab.content }}
				</div>
			</div>
		</div>
	</div>
</template>

<script>
console.log = chrome.extension.getBackgroundPage().console.log
import md5 from 'blueimp-md5'

export default {
	data() {
		return {
			domain: '-',
			domainRoot: '',
			valid: false,
			tabs: [],
			tabActive: 0,
			data: {
				domain: null,
				whois: null,
				whoisD: null, // whois server with more details
				ns: null,
				dns: null,
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
					found: 0,
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
						'Abuse Contact',
						'Registrar Abuse Contact Phone',
						'Reseller',
						'Reseller URL',
						'Referral URL',
						'Registrar-Reseller Name',
						'Reseller Email',
						'admin-contact',
						'source',
					],
					found: 0,
				},
				{
					title: 'Contact - Registrant',
					fields: [
						'Registry Registrant ID',
						'Registrant ID',
						'Registrant Name',
						'Registrant Organization',
						'Registrant Organisation',
						'Registrant Street',
						'Registrant City',
						'Registrant State/Province',
						'Registrant State',
						'Registrant Postal Code',
						'Registrant Country',
						'Registrant Phone',
						'Registrant Email',
						'Registrant Phone Ext',
						'Registrant Fax',
						'Registrant Fax Ext',
						'Registrant Phone Ext.',
						'Registrant Fax Ext.',
						'Registrant Application Purpose',
						'Registrant Nexus Category',
					],
					found: 0,
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
					found: 0,
				},
				{
					title: 'Contact - Tech',
					fields: [
						'Registry Tech ID',
						'Tech Name',
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
					found: 0,
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
					found: 0,
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
				content2: 'loading WHOIS',
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

			this.tabs.push(tabOverview)
			this.tabs.push(tabWhois)
			this.tabs.push(tabNs)
			this.tabs.push(tabDns)

			// Get Domain status
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/domain/${this.domain}`,
				})
				.then(re => {
					if (re.error) {
						throw re.error
					}

					this.domainRoot = re.domain
					this.data.domain = re
					tabOverview.status = 'loaded'
					tabOverview.subtitle = re.status
					tabOverview.content = re
				})
				.catch(err => {
					tabOverview.status = 'error'
					tabOverview.subtitle = 'error'
					tabOverview.content = err
				})

			// Get WHOIS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/whois/${this.domain}`,
				})
				.then(whoisResponse => {
					if (whoisResponse.error) {
						throw whoisResponse.error
					}

					let i = 0
					this.data.whois = whoisResponse

					Object.keys(whoisResponse).forEach(whoisServer => {
						if (i === 0) {
							tabWhois.status = 'loaded'
							tabWhois.subtitle = whoisServer
							tabWhois.content = whoisResponse[whoisServer]
							tabWhois.content2 = JSON.parse(JSON.stringify(whoisResponse[whoisServer]))
							this.data.whoisD = whoisResponse[whoisServer]

							if (whoisResponse[whoisServer]['Domain Name']) {
								this.domainRoot = whoisResponse[whoisServer]['Domain Name'].toLowerCase()
							}
						} else {
							this.tabs.splice(i + 1, 0, {
								status: 'loaded',
								title: 'WHOIS',
								subtitle: whoisServer,
								content: whoisResponse[whoisServer],
								content2: JSON.parse(JSON.stringify(whoisResponse[whoisServer])),
							})
							if (!whoisResponse[whoisServer].error) {
								this.data.whoisD = whoisResponse[whoisServer]
							}
						}

						i++
					})
				})
				.catch(err => {
					tabWhois.status = 'error'
					tabWhois.subtitle = 'error'
					tabWhois.content = err
				})

			// Get NS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/name-servers/${this.domain}`,
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

			// Get DNS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `https://api.dmns.app/dns-records/${this.domain}`,
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
			date = new Date(date)

			return date.toLocaleDateString()
		},
		inDays(date, toDate) {
			const t1 = new Date(date)
			const t2 = toDate || new Date()

			return Math.round((t1.getTime() - t2.getTime()) / (24 * 3600 * 1000))
		},
		getPicture(email) {
			const imgClearbit = `https://logo.clearbit.com/${this.domainRoot || this.domain}?size=50`

			return email ? `https://www.gravatar.com/avatar/${md5(email)}?s=50&d=${imgClearbit}` : imgClearbit
		},
		idMX(mx) {
			const mxServers = {
				'emailsrvr.com': {
					name: 'Rackspace Email',
					url: 'https://www.rackspace.com/email-hosting/webmail',
				},
				'gmr-smtp-in.l.google.com': {
					name: 'Gmail',
					url: 'https://www.google.com/gmail/about/',
				},
				'googlemail.com': {
					name: 'G Suite',
					url: 'https://gsuite.google.com/products/gmail/',
				},
				'google.com': {
					name: 'G Suite',
					url: 'https://gsuite.google.com/products/gmail/',
				},
			}

			return email ? `https://www.gravatar.com/avatar/${md5(email)}?s=50&d=${imgClearbit}` : imgClearbit
		},
	},
}
</script>

<style lang="scss" scoped>
@import '~bootstrap/scss/bootstrap';

a {
	color: rgb(70, 13, 141);
}

.app-popup {
	height: 400px;
	width: 600px;
	cursor: default;
}
.tabs ul {
	padding: 0;
	position: sticky;
	top: 0;
	background: #fff;

	li {
		margin: 1rem 0.5rem 0 0;
		padding: 5px 8px;
		display: inline-block;
		border-radius: 2px;
		border-bottom: 2px solid rgba(70, 13, 141, 0.2);
		cursor: pointer;
		text-align: center;
	}

	li.error {
		border-color: #f5c6cb;
	}

	li.active {
		border-color: rgba(70, 13, 141, 0.9);
	}

	li.active.error {
		border-color: #721c24;
	}
}
.badge {
	font-size: 90% !important;
}
.badge-registered {
	color: rgb(70, 13, 141);
	background-color: rgba(70, 13, 141, 0.07);
}
.badge-available {
	color: #004085;
	background-color: #cce5ff;
}
.badge-unknown {
	color: #856404;
	background-color: #fff3cd;
}

.ttl {
	display: inline-block;
	min-width: 50px;
}
</style>
