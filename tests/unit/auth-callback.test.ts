import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedCallbackPath, sanitizeAllowedCallbackPath } from "../../lib/auth-callback.ts";

test("acepta callback interno con subruta de pedido", () => {
  assert.equal(isAllowedCallbackPath("/area-cliente/pedido/26_001/pagar"), true);
  assert.equal(
    sanitizeAllowedCallbackPath("/area-cliente/pedido/26_001/pagar", "/area-cliente"),
    "/area-cliente/pedido/26_001/pagar"
  );
});

test("rechaza open redirects o rutas externas", () => {
  assert.equal(isAllowedCallbackPath("https://evil.example"), false);
  assert.equal(isAllowedCallbackPath("//evil.example"), false);
  assert.equal(
    sanitizeAllowedCallbackPath("https://evil.example", "/area-cliente"),
    "/area-cliente"
  );
});

