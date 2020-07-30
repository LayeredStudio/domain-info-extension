<template>

	<div class="text-center">
		<transition name="fade" mode="in-out">
			<p v-if="message" class="lead" :key="message">{{ message }}</p>
		</transition>
	</div>

</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity .4s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>

<script>
import messages from '../loading-messages.js'

export default {
	name: 'Loading',
	props: ['interval'],
	data() {
		return {
			t: null,
			message: null,
		}
	},
	created() {
		this.t = setTimeout(this.setMessage, 1000)
	},
	methods: {
		setMessage() {
			this.message = null

			setTimeout(() => {
				this.message = messages[Math.floor(Math.random() * messages.length)]
			}, 400)

			this.t = setTimeout(this.setMessage, this.interval || 4000)
		}
	},
}
</script>
