import { createApp } from 'vue'
import Popper from "vue3-popper";
import './style.css'
import App from './App.vue'

createApp(App).component("Popper", Popper).mount('#app')
