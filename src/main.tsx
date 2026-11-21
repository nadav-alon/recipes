import { registerSW } from 'virtual:pwa-register'
import { render } from 'preact'
import 'household-ui/ui/tokens.css'
import 'household-ui/ui/base.css'
import './theme.css'
import './screens.css'
import { Root } from './Root.tsx'

render(<Root />, document.getElementById('app')!)

registerSW({ immediate: true })
