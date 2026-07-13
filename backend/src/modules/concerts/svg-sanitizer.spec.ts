import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from "@nestjs/common";
import { sanitizeSeatingSvgMarkup } from "./svg-sanitizer";

test("sanitizeSeatingSvgMarkup preserves case-sensitive SVG layout attributes", () => {
  const result = sanitizeSeatingSvgMarkup(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="100" height="100"><rect x="1" y="2" width="3" height="4" fill="red" stroke-width="2"></rect><text font-size="14" text-anchor="middle" dominant-baseline="middle">Seat</text></svg>',
  );

  assert.ok(result);
  assert.match(result!, /viewBox="0 0 100 100"/);
  assert.match(result!, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(result!, /font-size="14"/);
  assert.match(result!, /text-anchor="middle"/);
  assert.match(result!, /dominant-baseline="middle"/);
  assert.ok(!result!.includes("viewbox="));
  assert.ok(!result!.includes("preserveaspectratio="));
});

test("sanitizeSeatingSvgMarkup rejects dangerous SVG content", () => {
  assert.throws(
    () =>
      sanitizeSeatingSvgMarkup(
        '<svg><script>alert(1)</script><foreignObject><div>hi</div></foreignObject><rect onclick="alert(1)" fill="red"></rect><a href="javascript:alert(1)">x</a><path style="color:red"></path></svg>',
      ),
    BadRequestException,
  );
});

test("sanitizeSeatingSvgMarkup preserves a complete svg root with text content", () => {
  const result = sanitizeSeatingSvgMarkup(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text>Seat map</text></svg>',
  );

  assert.ok(result);
  assert.match(result!, /^<svg /);
  assert.match(result!, /<\/svg>$/);
  assert.match(result!, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(result!, /Seat map/);
});
