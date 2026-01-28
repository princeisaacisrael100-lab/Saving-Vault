;; Savings Vault Smart Contract
;; A secure savings vault that allows users to deposit STX, earn interest, and withdraw after a lock period

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-lock-period-active (err u103))
(define-constant err-invalid-amount (err u104))
(define-constant err-invalid-lock-period (err u105))
(define-constant err-already-exists (err u106))
(define-constant err-contract-paused (err u107))
(define-constant err-minimum-not-met (err u108))

;; Constants for calculations
(define-constant basis-points u10000)
(define-constant blocks-per-year u52560) ;; Approximately 144 blocks/day * 365 days
(define-constant min-lock-blocks u144) ;; Minimum 1 day lock
(define-constant max-lock-blocks u52560) ;; Maximum 365 days lock
(define-constant emergency-penalty-rate u1000) ;; 10% penalty in basis points

;; Data Variables
(define-data-var annual-interest-rate uint u500) ;; 5% in basis points
(define-data-var minimum-deposit uint u1000000) ;; 1 STX in microSTX
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

;; Read-only functions

;; Get user savings details
(define-read-only (get-user-savings (user principal))
  (ok (map-get? user-savings user))
)

;; Get user statistics
(define-read-only (get-user-stats (user principal))
  (ok (map-get? user-stats user))
)

;; Calculate pending interest for a user
(define-read-only (calculate-interest (user principal))
  (match (map-get? user-savings user)
    savings
    (let
      (
        (balance (get balance savings))
        (last-claim (get last-interest-claim savings))
        (blocks-elapsed (- block-height last-claim))
        ;; Interest = (balance * rate * blocks) / (basis-points * blocks-per-year)
        (interest (/ (* (* balance (var-get annual-interest-rate)) blocks-elapsed)
                    (* basis-points blocks-per-year)))
      )
      (ok interest)
    )
    (ok u0)
  )
)

;; Check if user can withdraw
(define-read-only (can-withdraw (user principal))
  (match (map-get? user-savings user)
    savings
    (let
      (
        (unlock-block (+ (get deposit-block savings) (get lock-period savings)))
      )
      (ok (>= block-height unlock-block))
    )
    (ok false)
  )
)

;; Get unlock block height for a user
(define-read-only (get-unlock-block (user principal))
  (match (map-get? user-savings user)
    savings
    (ok (+ (get deposit-block savings) (get lock-period savings)))
    err-not-found
  )
)

;; Get contract configuration
(define-read-only (get-contract-config)
  (ok {
    annual-interest-rate: (var-get annual-interest-rate),
    minimum-deposit: (var-get minimum-deposit),
    total-deposits: (var-get total-deposits),
    contract-paused: (var-get contract-paused),
    total-interest-paid: (var-get total-interest-paid),
    contract-balance: (stx-get-balance (as-contract tx-sender))
  })
)

;; Get total value locked (TVL)
(define-read-only (get-tvl)
  (ok (var-get total-deposits))
)

;; Check if contract is paused
(define-read-only (is-paused)
  (ok (var-get contract-paused))
)

;; Private functions

;; Update user stats
(define-private (update-user-stats (user principal) (deposit uint) (withdrawn uint) (interest uint))
  (let
    (
      (current-stats (default-to 
        {total-deposited: u0, total-withdrawn: u0, total-interest-earned: u0}
        (map-get? user-stats user)))
    )
    (map-set user-stats user {
      total-deposited: (+ (get total-deposited current-stats) deposit),
      total-withdrawn: (+ (get total-withdrawn current-stats) withdrawn),
      total-interest-earned: (+ (get total-interest-earned current-stats) interest)
    })
  )
)

;; Claim interest internal function
(define-private (claim-interest-internal (user principal))
  (match (map-get? user-savings user)
    savings
    (match (calculate-interest user)
      interest
      (if (> interest u0)
        (begin
          ;; Update last claim block
          (map-set user-savings user
            (merge savings {last-interest-claim: block-height})
          )
          ;; Transfer interest
          (match (as-contract (stx-transfer? interest tx-sender user))
            success
            (begin
              (var-set total-interest-paid (+ (var-get total-interest-paid) interest))
              (update-user-stats user u0 u0 interest)
              (ok interest)
            )
            error (err error)
          )
        )
        (ok u0)
      )
      error (err error)
    )
    err-not-found
  )
)

;; Public functions

;; Deposit STX with a lock period
(define-public (deposit (amount uint) (lock-period uint))
  (let
    (
      (user tx-sender)
      (existing-savings (map-get? user-savings user))
    )
    ;; Validation checks
    (asserts! (not (var-get contract-paused)) err-contract-paused)
    (asserts! (>= amount (var-get minimum-deposit)) err-minimum-not-met)
    (asserts! (>= lock-period min-lock-blocks) err-invalid-lock-period)
    (asserts! (<= lock-period max-lock-blocks) err-invalid-lock-period)
    
    ;; If user already has savings, claim interest first
    (match existing-savings
      savings
      (begin
        (try! (claim-interest-internal user))
        ;; Update existing savings
        (map-set user-savings user {
          balance: (+ (get balance savings) amount),
          deposit-block: block-height,
          lock-period: lock-period,
          last-interest-claim: block-height
        })
      )
      ;; Create new savings account
      (map-set user-savings user {
        balance: amount,
        deposit-block: block-height,
        lock-period: lock-period,
        last-interest-claim: block-height
      })
    )
    
    ;; Transfer STX to contract
    (try! (stx-transfer? amount user (as-contract tx-sender)))
    
    ;; Update total deposits and stats
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (update-user-stats user amount u0 u0)
    
    (ok amount)
  )
)

;; Withdraw after lock period expires
(define-public (withdraw)
  (let
    (
      (user tx-sender)
      (savings (unwrap! (map-get? user-savings user) err-not-found))
      (balance (get balance savings))
      (unlock-block (+ (get deposit-block savings) (get lock-period savings)))
    )
    ;; Validation checks
    (asserts! (> balance u0) err-insufficient-balance)
    (asserts! (>= block-height unlock-block) err-lock-period-active)
    
    ;; Claim any pending interest
    (try! (claim-interest-internal user))
    
    ;; Update savings (set balance to 0)
    (map-set user-savings user
      (merge savings {balance: u0})
    )
    
    ;; Transfer STX back to user
    (try! (as-contract (stx-transfer? balance tx-sender user)))
    
    ;; Update total deposits and stats
    (var-set total-deposits (- (var-get total-deposits) balance))
    (update-user-stats user u0 balance u0)
    
    (ok balance)
  )
)

;; Emergency withdrawal with penalty
(define-public (emergency-withdraw)
  (let
    (
      (user tx-sender)
      (savings (unwrap! (map-get? user-savings user) err-not-found))
      (balance (get balance savings))
      (penalty (/ (* balance emergency-penalty-rate) basis-points))
      (withdraw-amount (- balance penalty))
    )
    ;; Validation checks
    (asserts! (> balance u0) err-insufficient-balance)
    
    ;; Update savings (set balance to 0)
    (map-set user-savings user
      (merge savings {balance: u0})
    )
    
    ;; Transfer STX back to user (minus penalty)
    (try! (as-contract (stx-transfer? withdraw-amount tx-sender user)))
    
    ;; Update total deposits and stats
    (var-set total-deposits (- (var-get total-deposits) balance))
    (update-user-stats user u0 withdraw-amount u0)
    
    (ok {withdrawn: withdraw-amount, penalty: penalty})
  )
)

;; Claim accrued interest
(define-public (claim-interest)
  (claim-interest-internal tx-sender)
)

;; Owner functions

;; Set annual interest rate (owner only)
(define-public (set-interest-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= new-rate u5000) err-invalid-amount) ;; Max 50%
    (var-set annual-interest-rate new-rate)
    (ok true)
  )
)

;; Set minimum deposit (owner only)
(define-public (set-minimum-deposit (new-minimum uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set minimum-deposit new-minimum)
    (ok true)
  )
)

;; Pause contract (owner only)
(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused true)
    (ok true)
  )
)

;; Unpause contract (owner only)
(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused false)
    (ok true)
  )
)

;; Fund contract for interest payments (owner only)
(define-public (fund-contract (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (stx-transfer? amount tx-sender (as-contract tx-sender))
  )
)

;; Withdraw excess funds (owner only, cannot withdraw user deposits)
(define-public (withdraw-excess)
  (let
    (
      (contract-balance (stx-get-balance (as-contract tx-sender)))
      (total-locked (var-get total-deposits))
      (excess (- contract-balance total-locked))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> excess u0) err-insufficient-balance)
    (as-contract (stx-transfer? excess tx-sender contract-owner))
  )
)
