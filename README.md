[![Sdk](https://img.shields.io/badge/sdk%20version-v0.11.9-blue?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@owneraio/finp2p-sdk-js/v/0.11.9)

# FinP2P wallet samples
A collection of flows using [finp2p-sdk-js](https://www.npmjs.com/package/@owneraio/finp2p-sdk-js).  
Clone this repository then run `yarn` or `npm install`

## Setup
To be able to run the scripts, you will need to provide a configuration to allow the sdk connect to your environment.  
Duplicate and rename the `sample.config.ts` file to `config.ts`.  
Then provide the missing parameters (provided by **Ownera**):

| required | parameter              | value                                       |
|----------|------------------------|---------------------------------------------|
| **yes**  | `orgId`                | your organization id                        |
| **yes**  | `apiKey`               | your organization api key to use FinP2P     |
| **yes**  | `privateKey`           | your organization private key to use FinP2P |
| **yes**  | `USER_ID`              | FinP2P profile id of the user to test       |
| **yes**  | `USER_CUSTODY_ACCOUNT` | Custody account id of the user to test      |
| *no*     | `ASSET_ID`             | FinP2P profile id of the asset to use       |

## Usage
The `package.json` file contains a `scripts` section that allows you to run the different flow directly from the command line.  

Ex: `yarn doInvestFlow` or `npm run doInvestFlow`

## Scripts
There are the flows that you can run directly:

| name         | scenario                                                                                                                                                                                                                                          |
|--------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| doInvestFlow | Get the user from the config, display its initial holdings, execute an issuance then display user final holdings.<br/>If an asset is provided in the config, it will be used. Else, the script will prompt a selection of possible assets to use. |
