import { OwneraAPIOptions } from '@owneraio/finp2p-sdk-js/lib/types/Core/OwneraAPI';

const envName = 'demo1';
const protocol = 'https://';

// Organisation secrets - required
export const orgData = {
  orgId: '',
  apiKey: '',
  privateKey: '',
};

// Target user id - required
export const USER_ID = '';
export const USER_CUSTODY_ACCOUNT = '';
// Target asset id - optional - if not provided, a prompt will ask to
export const ASSET_ID = '';

export const getConfig = (r: { orgId: string; apiKey: string; privateKey: string; }): OwneraAPIOptions => ({
  orgId: r.orgId,
  owneraAPIAddress: `${protocol}${r.orgId}.api.${envName}.ownera.io/`,
  owneraRASAddress: `${protocol}regappstore-ownera-ras.api.${envName}.ownera.io`,
  custodyAdapterBaseURL: `${protocol}${r.orgId}.api.${envName}.ownera.io/custody/`,
  authConfig: {
    apiKey: r.apiKey,
    secret: {
      type: 2,
      raw: r.privateKey,
    },
  },
});
