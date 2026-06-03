module walrus_urchin::profile {
    use std::string::String;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    public struct CreatorProfile has key {
        id: UID,
        handle: String,
        payout: address,
    }

    public struct CreatorCap has key, store {
        id: UID,
        profile_id: ID,
    }

    public struct CreatorRegistered has copy, drop {
        profile_id: ID,
        owner: address,
    }

    public entry fun create_profile(handle: String, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        let profile = CreatorProfile {
            id: object::new(ctx),
            handle,
            payout: owner,
        };
        let profile_id = object::id(&profile);
        let event = CreatorRegistered {
            profile_id,
            owner,
        };
        let cap = CreatorCap {
            id: object::new(ctx),
            profile_id,
        };

        sui::event::emit(event);
        transfer::share_object(profile);
        transfer::public_transfer(cap, owner);
    }
}
