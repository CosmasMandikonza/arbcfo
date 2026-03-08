// main.rs — Required for `cargo stylus export-abi`
// This file is only used when exporting the ABI, not in the WASM binary.
#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
extern crate alloc;

#[cfg(feature = "export-abi")]
fn main() {
    arbcfo_risk_engine::print_abi("MIT-OR-APACHE-2.0", "pragma solidity ^0.8.24;");
}

#[cfg(not(feature = "export-abi"))]
fn main() {}
