## **1.2.0**

- Add support for iteratable maps
- fix to not try to unobserve `null` objects

## **1.1.2**

Fix NPM release

## **1.1.1**

Cleanup Sourcemaps

## **1.1.0**

Add browser bundle.

## **1.0.0**

Change how the path of a change is constructed. Now the parent(s) of each object are tracked, instead of the path directly. This is less error-prone, especially for arrays (array shifts etc.).