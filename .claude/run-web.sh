#!/bin/bash
export PATH="/Users/nikola/.nvm/versions/node/v22.22.2/bin:$PATH"
cd /Users/nikola/farmprint
exec pnpm --filter @printfarm/web dev
