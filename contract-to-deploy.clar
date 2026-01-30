;; Savings Vault Smart Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-lock-period-active (err u103))
(define-constant err-invalid-amount (err u104))
(define-constant err-invalid-lock-period (err u105))
(define-constant err-contract-paused (err u107))
(define-constant err-minimum-not-met (err u108))
(define-constant basis-points u10000)
(define-constant blocks-per-year u52560)
(define-constant min-lock-blocks u144)
(define-constant max-lock-blocks u52560)
(define-constant emergency-penalty-rate u1000)

;; Data Variables
(define-data-var annual-interest-rate uint u500)
(define-data-var minimum-deposit uint u1000000)
(define-data-var total-deposits uint u0)
(define-data-var contract-paused bool false)
(define-data-var total-interest-paid uint u0)

;; Data Maps
(define-map user-savings
  principal
  {
    balance: uint,
    deposit-block: uint,
    lock-period: uint,
    last-interest-claim: uint
  }
)

(define-map user-stats
  principal
  {
    total-deposited: uint,
    total-withdrawn: uint,
    total-interest-earned: uint
  }
)

;; Read-Only Functions
(define-read-only (calculate-interest (user principal))
  (match (map-get? user-savings user)
    savings
    (let (
        (blocks (- burn-block-height (get last-interest-claim savings)))
        (interest
          (/ (* (* (get balance savings)
                   (var-get annual-interest-rate))
                blocks)
             (* basis-points blocks-per-year))
        )
      )
      (ok interest)
    )
    (ok u0)
  )
)

(define-read-only (get-user-savings (user principal))
  (map-get? user-savings user)
)

(define-read-only (get-user-stats (user principal))
  (map-get? user-stats user)
)

(define-read-only (get-contract-info)
  (ok {
    annual-interest-rate: (var-get annual-interest-rate),
    minimum-deposit: (var-get minimum-deposit),
    total-deposits: (var-get total-deposits),
    contract-paused: (var-get contract-paused),
    total-interest-paid: (var-get total-interest-paid)
  })
)

;; Private Functions
(define-private (claim-interest-internal (user principal))
  (let (
      (savings (unwrap! (map-get? user-savings user) err-not-found))
      (interest (unwrap! (calculate-interest user) err-invalid-amount))
    )
    (if (> interest u0)
      (begin
        (map-set user-savings user
          (merge savings { last-interest-claim: burn-block-height })
        )
        (try! (as-contract (stx-transfer? interest tx-sender user)))
        (var-set total-interest-paid
          (+ (var-get total-interest-paid) interest))
        (let (
            (stats
              (default-to
                { total-deposited: u0, total-withdrawn: u0, total-interest-earned: u0 }
                (map-get? user-stats user)))
          )
          (map-set user-stats user {
            total-deposited: (get total-deposited stats),
            total-withdrawn: (get total-withdrawn stats),
            total-interest-earned: (+ (get total-interest-earned stats) interest)
          })
        )
        (ok interest)
      )
      (ok u0)
    )
  )
)

;; Public Functions
(define-public (deposit (amount uint) (lock-period uint))
  (let ((user tx-sender))
    (asserts! (not (var-get contract-paused)) err-contract-paused)
    (asserts! (>= amount (var-get minimum-deposit)) err-minimum-not-met)
    (asserts! (>= lock-period min-lock-blocks) err-invalid-lock-period)
    (asserts! (<= lock-period max-lock-blocks) err-invalid-lock-period)
    (match (map-get? user-savings user)
      savings
      (begin
        (try! (claim-interest-internal user))
        (map-set user-savings user {
          balance: (+ (get balance savings) amount),
          deposit-block: burn-block-height,
          lock-period: lock-period,
          last-interest-claim: burn-block-height
        })
      )
      (map-set user-savings user {
        balance: amount,
        deposit-block: burn-block-height,
        lock-period: lock-period,
        last-interest-claim: burn-block-height
      })
    )
    (try! (stx-transfer? amount user (as-contract tx-sender)))
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (let (
        (stats
          (default-to
            { total-deposited: u0, total-withdrawn: u0, total-interest-earned: u0 }
            (map-get? user-stats user)))
      )
      (map-set user-stats user {
        total-deposited: (+ (get total-deposited stats) amount),
        total-withdrawn: (get total-withdrawn stats),
        total-interest-earned: (get total-interest-earned stats)
      })
    )
    (ok amount)
  )
)

(define-public (withdraw)
  (let (
      (user tx-sender)
      (savings (unwrap! (map-get? user-savings user) err-not-found))
      (balance (get balance savings))
      (unlock (+ (get deposit-block savings) (get lock-period savings)))
    )
    (asserts! (> balance u0) err-insufficient-balance)
    (asserts! (>= burn-block-height unlock) err-lock-period-active)
    (try! (claim-interest-internal user))
    (map-set user-savings user (merge savings { balance: u0 }))
    (try! (as-contract (stx-transfer? balance tx-sender user)))
    (var-set total-deposits (- (var-get total-deposits) balance))
    (let (
        (stats
          (default-to
            { total-deposited: u0, total-withdrawn: u0, total-interest-earned: u0 }
            (map-get? user-stats user)))
      )
      (map-set user-stats user {
        total-deposited: (get total-deposited stats),
        total-withdrawn: (+ (get total-withdrawn stats) balance),
        total-interest-earned: (get total-interest-earned stats)
      })
    )
    (ok balance)
  )
)

(define-public (emergency-withdraw)
  (let (
      (user tx-sender)
      (savings (unwrap! (map-get? user-savings user) err-not-found))
      (balance (get balance savings))
      (penalty (/ (* balance emergency-penalty-rate) basis-points))
      (amount (- balance penalty))
    )
    (asserts! (> balance u0) err-insufficient-balance)
    (map-set user-savings user (merge savings { balance: u0 }))
    (try! (as-contract (stx-transfer? amount tx-sender user)))
    (var-set total-deposits (- (var-get total-deposits) balance))
    (let (
        (stats
          (default-to
            { total-deposited: u0, total-withdrawn: u0, total-interest-earned: u0 }
            (map-get? user-stats user)))
      )
      (map-set user-stats user {
        total-deposited: (get total-deposited stats),
        total-withdrawn: (+ (get total-withdrawn stats) amount),
        total-interest-earned: (get total-interest-earned stats)
      })
    )
    (ok { withdrawn: amount, penalty: penalty })
  )
)

(define-public (claim-interest)
  (claim-interest-internal tx-sender)
)

;; Owner Functions
(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-interest-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set annual-interest-rate new-rate)
    (ok true)
  )
)

(define-public (set-minimum-deposit (new-minimum uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set minimum-deposit new-minimum)
    (ok true)
  )
)
