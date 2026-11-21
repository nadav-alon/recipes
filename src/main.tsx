import { registerSW } from 'virtual:pwa-register'
import { render } from 'preact'
import { App } from './App.tsx'

render(<App />, document.getElementById('app')!)

registerSW({ immediate: true })
