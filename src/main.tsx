import { registerSW } from 'virtual:pwa-register'
import { render } from 'preact'
import { Root } from './Root.tsx'

render(<Root />, document.getElementById('app')!)

registerSW({ immediate: true })
