;; Savings Vault Smart Contract
;; A simple savings vault that allows users to deposit STX and withdraw after a time lock

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-time-lock-active (err u102))
(define-constant err-no-vault (err u103))

;; Data Variables
(define-data-var minimum-lock-period uint u144) ;; ~1 day in blocks (assuming 10 min blocks)

;; Data Maps
(define-map vaults
    principal
    {
        balance: uint,
        lock-until: uint,
        total-deposited: uint
    }
)

;; Read-only functions
(define-read-only (get-vault (user principal))
    (map-get? vaults user)
)

(define-read-only (get-balance (user principal))
    (match (map-get? vaults user)
        vault (ok (get balance vault))
        (err err-no-vault)
    )
)

(define-read-only (get-lock-period)
    (ok (var-get minimum-lock-period))
)

(define-read-only (is-locked (user principal))
    (match (map-get? vaults user)
        vault (ok (> (get lock-until vault) stacks-block-height))
        (err err-no-vault)
    )
)

;; Public functions
(define-public (deposit (amount uint))
    (let
        (
            (current-vault (default-to 
                {balance: u0, lock-until: u0, total-deposited: u0}
                (map-get? vaults tx-sender)
            ))
            (new-lock-until (+ stacks-block-height (var-get minimum-lock-period)))
        )
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (map-set vaults tx-sender {
            balance: (+ (get balance current-vault) amount),
            lock-until: new-lock-until,
            total-deposited: (+ (get total-deposited current-vault) amount)
        })
        (ok true)
    )
)

(define-public (withdraw (amount uint))
    (let
        (
            (vault (unwrap! (map-get? vaults tx-sender) err-no-vault))
        )
        (asserts! (<= (get lock-until vault) stacks-block-height) err-time-lock-active)
        (asserts! (>= (get balance vault) amount) err-insufficient-balance)
        
        (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
        (map-set vaults tx-sender {
            balance: (- (get balance vault) amount),
            lock-until: (get lock-until vault),
            total-deposited: (get total-deposited vault)
        })
        (ok true)
    )
)

(define-public (withdraw-all)
    (let
        (
            (vault (unwrap! (map-get? vaults tx-sender) err-no-vault))
            (balance (get balance vault))
        )
        (asserts! (<= (get lock-until vault) stacks-block-height) err-time-lock-active)
        (asserts! (> balance u0) err-insufficient-balance)
        
        (try! (as-contract (stx-transfer? balance tx-sender tx-sender)))
        (map-set vaults tx-sender {
            balance: u0,
            lock-until: (get lock-until vault),
            total-deposited: (get total-deposited vault)
        })
        (ok true)
    )
)

;; Admin functions
(define-public (set-lock-period (new-period uint))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set minimum-lock-period new-period)
        (ok true)
    )
)