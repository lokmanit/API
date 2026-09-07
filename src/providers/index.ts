import { config } from '../config';
import { TelephonyProvider } from './telephonyProvider.interface';
import { MockTelephonyProvider } from './mockTelephonyProvider';
import { RealTelephonyProvider } from './realTelephonyProvider';
import { logger } from '../utils/logger';

let currentProvider: TelephonyProvider | null = null;

export function getTelephonyProvider(): TelephonyProvider {
  if (!currentProvider) {
    if (config.telephonyProvider === 'real') {
      logger.info('Instantiating RealTelephonyProvider');
      currentProvider = new RealTelephonyProvider();
    } else {
      logger.info('Instantiating MockTelephonyProvider');
      currentProvider = new MockTelephonyProvider();
    }
  }
  return currentProvider;
}

export function setTelephonyProvider(provider: TelephonyProvider) {
  currentProvider = provider;
  logger.info(`Switched active telephony provider to: ${provider.name}`);
}

export type { TelephonyProvider };
export { MockTelephonyProvider, RealTelephonyProvider };
