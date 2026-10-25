import { registerSW } from 'virtual:pwa-register';

import './styles.css';
import './app';

registerSW({ immediate: true });
